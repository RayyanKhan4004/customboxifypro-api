import { Injectable } from '@nestjs/common';

import { CacheInvalidationService } from '../cache/cache-invalidation.service';
import { ApiException } from '../common/exceptions/api.exception';
import { ErrorCodes } from '../common/constants/error-codes';
import { AppLogger } from '../common/logger/logger.service';
import { AuditService } from '../audit-logs/audit.service';
import { AuditActions } from '../audit-logs/audit-actions';
import { FilterDefinitionRepository } from './repositories/filter-definition.repository';
import {
  FilterDefinition,
  FilterDefinitionDocument,
} from './schemas/filter-definition.schema';
import {
  CreateFilterDefinitionDto,
  UpdateFilterDefinitionDto,
} from './dto/filter-definition.dto';

@Injectable()
export class FilterDefinitionsService {
  constructor(
    private readonly repository: FilterDefinitionRepository,
    private readonly cacheInvalidator: CacheInvalidationService,
    private readonly audit: AuditService,
    private readonly logger: AppLogger,
  ) {}

  async listPublic(): Promise<Array<Record<string, unknown>>> {
    const definitions = await this.repository.findActive();
    return definitions
      .filter((definition) => definition.filterable)
      .map((definition) => this.toDto(definition));
  }

  async listForEditor(): Promise<Array<Record<string, unknown>>> {
    const definitions = await this.repository.findActive();
    return definitions.map((definition) => this.toDto(definition));
  }

  /** Raw active definitions used for dynamic attribute validation (products). */
  async listActive(): Promise<FilterDefinition[]> {
    return this.repository.findActive();
  }

  async listAdmin(): Promise<Array<Record<string, unknown>>> {
    const definitions = await this.repository.findAll();
    return definitions.map((definition) => this.toDto(definition));
  }

  async create(
    dto: CreateFilterDefinitionDto,
    actorId: string,
  ): Promise<Record<string, unknown>> {
    if (await this.repository.countByKey(dto.key)) {
      throw ApiException.conflict(
        ErrorCodes.FILTER_KEY_EXISTS,
        'A filter with this key already exists.',
      );
    }
    const created = await this.repository.create({
      ...dto,
      key: dto.key.toLowerCase(),
      options: dto.options ?? [],
      validation: dto.validation ?? {},
      categoryScope: dto.categoryScope ?? ['all'],
    });
    await this.invalidate();
    await this.audit.log({
      actorId,
      action: AuditActions.FILTER_CREATED,
      resourceType: 'filter-definition',
      resourceId: String(created._id),
      after: { key: created.key, dataType: created.dataType },
    });
    return { id: String(created._id), key: created.key };
  }

  async update(
    id: string,
    dto: UpdateFilterDefinitionDto,
    actorId: string,
  ): Promise<Record<string, unknown>> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw ApiException.notFound(
        ErrorCodes.FILTER_NOT_FOUND,
        'Filter definition not found.',
      );
    }
    await this.repository.update(id, dto);
    await this.invalidate();
    await this.audit.log({
      actorId,
      action: AuditActions.FILTER_UPDATED,
      resourceType: 'filter-definition',
      resourceId: id,
      after: dto,
    });
    return { id };
  }

  async remove(id: string, actorId: string): Promise<void> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw ApiException.notFound(
        ErrorCodes.FILTER_NOT_FOUND,
        'Filter definition not found.',
      );
    }
    await this.repository.softDelete(id);
    await this.invalidate();
    await this.audit.log({
      actorId,
      action: AuditActions.FILTER_DELETED,
      resourceType: 'filter-definition',
      resourceId: id,
    });
  }

  private async invalidate(): Promise<void> {
    await this.cacheInvalidator.invalidateFilters();
    await this.cacheInvalidator.invalidateProducts();
  }

  private toDto(definition: FilterDefinitionDocument): Record<string, unknown> {
    return {
      id: String(definition._id),
      name: definition.name,
      key: definition.key,
      label: definition.label,
      dataType: definition.dataType,
      categoryScope: definition.categoryScope,
      options: definition.options,
      searchable: definition.searchable,
      filterable: definition.filterable,
      sortable: definition.sortable,
      required: definition.required,
      multiple: definition.multiple,
      displayOrder: definition.displayOrder,
      validation: definition.validation,
      isActive: definition.isActive,
    };
  }
}
