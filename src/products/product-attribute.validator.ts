import { Injectable } from '@nestjs/common';

import { ErrorCodes } from '../common/constants/error-codes';
import { ApiException } from '../common/exceptions/api.exception';
import { FilterDefinition } from '../filter-definitions/schemas/filter-definition.schema';
import { ProductFacet } from './schemas/product.schema';

export interface AttributeValidationResult {
  attributes: Map<string, unknown>;
  facets: ProductFacet[];
}

@Injectable()
export class ProductAttributeValidator {
  /**
   * Validates arbitrary product attributes against the active filter
   * definitions (never hardcoded) and produces the denormalized facet array
   * used for indexed filtering.
   */
  validate(
    input: Record<string, unknown>,
    definitions: FilterDefinition[],
    categoryId: string,
  ): AttributeValidationResult {
    const attributes = new Map<string, unknown>();
    const facets: ProductFacet[] = [];
    const seen = new Set<string>();

    for (const [key, rawValue] of Object.entries(input)) {
      const definition = definitions.find((d) => d.key === key);
      if (!definition) {
        throw ApiException.invalid(
          ErrorCodes.UNKNOWN_FILTER_KEY,
          `Attribute "${key}" does not match any active filter definition.`,
          [{ field: key, message: `Unknown attribute key "${key}".` }],
        );
      }
      seen.add(key);
      const value = this.normalize(definition, rawValue);
      attributes.set(key, value);
      if (definition.filterable) {
        this.pushFacets(facets, key, value);
      }
    }

    for (const definition of definitions) {
      if (!definition.required) continue;
      const applies =
        definition.categoryScope.includes('all') ||
        definition.categoryScope.includes(categoryId);
      if (applies && !seen.has(definition.key)) {
        throw ApiException.invalid(
          ErrorCodes.PRODUCT_VALIDATION_FAILED,
          `Required attribute "${definition.key}" is missing.`,
          [{ field: definition.key, message: 'This attribute is required.' }],
        );
      }
    }

    return { attributes, facets };
  }

  private normalize(definition: FilterDefinition, raw: unknown): unknown {
    switch (definition.dataType) {
      case 'string': {
        const value = String((raw as string | number | boolean) ?? '').trim();
        const pattern = definition.validation?.pattern;
        if (pattern && !new RegExp(pattern).test(value)) {
          throw ApiException.invalid(
            ErrorCodes.PRODUCT_VALIDATION_FAILED,
            `Attribute "${definition.key}" does not match the required pattern.`,
            [
              {
                field: definition.key,
                message: 'Value does not match the allowed pattern.',
              },
            ],
          );
        }
        return value;
      }
      case 'number': {
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          throw ApiException.invalid(
            ErrorCodes.PRODUCT_VALIDATION_FAILED,
            `Attribute "${definition.key}" must be a number.`,
            [{ field: definition.key, message: 'Expected a numeric value.' }],
          );
        }
        const { min, max } = definition.validation ?? {};
        if (min !== undefined && value < min) {
          throw ApiException.invalid(
            ErrorCodes.PRODUCT_VALIDATION_FAILED,
            `Attribute "${definition.key}" is below the minimum of ${min}.`,
            [{ field: definition.key, message: `Minimum is ${min}.` }],
          );
        }
        if (max !== undefined && value > max) {
          throw ApiException.invalid(
            ErrorCodes.PRODUCT_VALIDATION_FAILED,
            `Attribute "${definition.key}" exceeds the maximum of ${max}.`,
            [{ field: definition.key, message: `Maximum is ${max}.` }],
          );
        }
        return value;
      }
      case 'boolean': {
        if (typeof raw === 'boolean') return raw;
        if (raw === 'true' || raw === 1 || raw === '1') return true;
        if (raw === 'false' || raw === 0 || raw === '0') return false;
        throw ApiException.invalid(
          ErrorCodes.PRODUCT_VALIDATION_FAILED,
          `Attribute "${definition.key}" must be a boolean.`,
          [{ field: definition.key, message: 'Expected true/false.' }],
        );
      }
      case 'enum': {
        const allowed = definition.options.map((o) => o.value);
        if (!allowed.includes(String(raw))) {
          throw ApiException.invalid(
            ErrorCodes.PRODUCT_VALIDATION_FAILED,
            `Attribute "${definition.key}" has an invalid value.`,
            [
              {
                field: definition.key,
                message: `Allowed values: ${allowed.join(', ')}.`,
              },
            ],
          );
        }
        return String(raw);
      }
      case 'multiselect': {
        const allowed = definition.options.map((o) => o.value);
        const values = Array.isArray(raw) ? raw : [raw];
        const normalized = values.map((v) => String(v));
        const invalid = normalized.find((v) => !allowed.includes(v));
        if (invalid !== undefined) {
          throw ApiException.invalid(
            ErrorCodes.PRODUCT_VALIDATION_FAILED,
            `Attribute "${definition.key}" has an invalid value "${invalid}".`,
            [
              {
                field: definition.key,
                message: `Allowed values: ${allowed.join(', ')}.`,
              },
            ],
          );
        }
        return normalized;
      }
      default:
        return raw;
    }
  }

  private pushFacets(
    facets: ProductFacet[],
    key: string,
    value: unknown,
  ): void {
    if (Array.isArray(value)) {
      for (const item of value) facets.push({ key, value: item as string });
    } else if (value !== null && value !== undefined && value !== '') {
      facets.push({ key, value: value as string | number | boolean });
    }
  }
}
