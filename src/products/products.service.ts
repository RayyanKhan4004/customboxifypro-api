import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';

import { CacheInvalidationService } from '../cache/cache-invalidation.service';
import { CacheService } from '../cache/cache.service';
import { AuditService } from '../audit-logs/audit.service';
import { AuditActions } from '../audit-logs/audit-actions';
import { ErrorCodes } from '../common/constants/error-codes';
import { ApiException } from '../common/exceptions/api.exception';
import {
  AdminPagedData,
  adminPageData,
  PagedData,
} from '../common/dto/pagination.types';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { AppLogger } from '../common/logger/logger.service';
import { hashQuery, slugify } from '../common/utils/strings';
import { decodeCursorOrThrow, encodeCursor } from '../common/utils/cursor';
import { SearchService } from '../search/search.service';
import { CategoryRepository } from '../categories/repositories/category.repository';
import { FilterDefinitionsService } from '../filter-definitions/filter-definitions.service';
import { FilterDefinition } from '../filter-definitions/schemas/filter-definition.schema';
import { MediaService } from '../media/media.service';
import { ProductAttributeValidator } from './product-attribute.validator';
import { ProductRepository } from './repositories/product.repository';
import { Product, ProductImage } from './schemas/product.schema';
import { toDetail, toListItem } from './product.mapper';
import {
  AdminListProductQueryDto,
  CreateProductDto,
  isSortField,
  PublicListProductQueryDto,
  UpdateProductDto,
} from './dto/product.dto';

interface FacetFilter {
  key: string;
  values: Array<string | number | boolean>;
}

interface FacetAggregateItem {
  _id: { key: string; value: unknown };
  count: number;
}

@Injectable()
export class ProductsService {
  private readonly listCacheTtlMs: number;
  private readonly detailCacheTtlMs: number;

  constructor(
    private readonly repository: ProductRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly filterService: FilterDefinitionsService,
    private readonly attributeValidator: ProductAttributeValidator,
    private readonly searchService: SearchService,
    private readonly cache: CacheService,
    private readonly cacheInvalidator: CacheInvalidationService,
    private readonly mediaService: MediaService,
    private readonly audit: AuditService,
    private readonly logger: AppLogger,
    config: ConfigService,
  ) {
    this.listCacheTtlMs = Number(
      config.get('PRODUCT_LIST_CACHE_TTL_MS', 300_000),
    );
    this.detailCacheTtlMs = Number(
      config.get('PRODUCT_DETAIL_CACHE_TTL_MS', 600_000),
    );
  }

  async listPublic(
    query: PublicListProductQueryDto,
  ): Promise<Record<string, unknown>> {
    const definitions = await this.filterService.listActive();
    const limit = Math.min(query.limit ?? 20, 100);
    const base = await this.buildPublicMatch(query);
    const facetFilters = this.parseFilters(query.filters, definitions);
    const match: Record<string, unknown> = { ...base };
    if (facetFilters.length > 0) {
      match.$and = facetFilters.map((f) => ({
        facets: {
          $elemMatch: {
            key: f.key,
            value: { $in: f.values },
          },
        },
      }));
    }
    const sort = this.parseSort(query.sort);
    const queryHash = hashQuery({
      match,
      sort,
      limit,
      includeTotal: query.includeTotal,
      includeFacets: query.includeFacets,
    });

    if (!query.cursor) {
      const cached = await this.tryCache<ListPage>(
        `v1:products:list:${await this.cacheInvalidator.productsVersion()}:${queryHash}`,
      );
      if (cached) return cached as unknown as Record<string, unknown>;
    }

    const decoded = decodeCursorOrThrow(query.cursor);
    const cursorFilter = decoded ? this.cursorFilter(decoded, sort) : null;
    const effectiveMatch = cursorFilter
      ? { $and: [match, cursorFilter] }
      : match;

    const docs = await this.repository.find(
      effectiveMatch,
      sort,
      limit + 1,
      this.listProjection,
    );
    const hasNextPage = docs.length > limit;
    const items = docs.slice(0, limit);

    const urls = await this.mediaService.resolveUrls(
      items.map(
        (p) => p.images?.[0]?.key ?? p.images?.find((i) => i.isMain)?.key ?? '',
      ),
    );
    const data = items.map((p) => toListItem(p, urls));

    let nextCursor: string | null = null;
    if (hasNextPage) {
      const last = items[items.length - 1];
      const field = this.primarySortField(sort);
      nextCursor = encodeCursor([
        last[field as keyof Product],
        last._id.toString(),
      ]);
    }

    const meta: Record<string, unknown> = { nextCursor, hasNextPage, limit };
    if (query.includeTotal) meta.total = await this.repository.count(match);
    if (query.includeFacets)
      meta.facets = await this.buildFacets(match, definitions);

    const page = { data, meta } as unknown as PagedData<unknown>;
    if (!query.cursor) {
      await this.cache.set(
        `v1:products:list:${await this.cacheInvalidator.productsVersion()}:${queryHash}`,
        page,
        this.listCacheTtlMs,
      );
    }
    return page as unknown as Record<string, unknown>;
  }

  async getBySlug(slug: string): Promise<Record<string, unknown>> {
    const version = await this.cacheInvalidator.productsVersion();
    const cacheKey = `v1:products:detail:${version}:${slug}`;
    const cached = await this.tryCache<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const product = await this.repository.findPublicBySlug(slug);
    if (!product) {
      throw ApiException.notFound(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Product not found.',
      );
    }
    const urls = await this.mediaService.resolveUrls(
      (product.images ?? []).map((i) => i.key),
    );
    const detail = toDetail(product, urls) as unknown as Record<
      string,
      unknown
    >;
    await this.cache.set(cacheKey, detail, this.detailCacheTtlMs);
    return detail;
  }

  async findOne(id: string): Promise<Record<string, unknown>> {
    const product = await this.repository.findByIdLean(id);
    if (!product) {
      throw ApiException.notFound(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Product not found.',
      );
    }
    const urls = await this.mediaService.resolveUrls(
      (product.images ?? []).map((i) => i.key),
    );
    return toDetail(product, urls) as unknown as Record<string, unknown>;
  }

  async listPublicFilters(): Promise<Array<Record<string, unknown>>> {
    return this.filterService.listForEditor();
  }

  async listAdmin(
    query: AdminListProductQueryDto,
  ): Promise<AdminPagedData<Record<string, unknown>>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const match: Record<string, unknown> = query.includeDeleted
      ? { deletedAt: { $ne: null } }
      : { deletedAt: null };
    if (query.status) match.status = query.status;
    if (query.visibility) match.visibility = query.visibility;
    if (query.categoryId)
      match.categoryId = new Types.ObjectId(query.categoryId);
    if (query.search)
      match.name = { $regex: this.escapeRegex(query.search), $options: 'i' };

    const sortBy =
      query.sortBy && isSortField(query.sortBy) ? query.sortBy : 'updatedAt';
    const dir: 1 | -1 = query.sortDir === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy]: dir, _id: dir };

    const [docs, total] = await Promise.all([
      this.repository.find(
        match,
        sort,
        limit,
        this.listProjection,
        (page - 1) * limit,
      ),
      this.repository.count(match),
    ]);
    const urls = await this.mediaService.resolveUrls(
      docs.map(
        (p) => p.images?.find((i) => i.isMain)?.key ?? p.images?.[0]?.key ?? '',
      ),
    );
    return adminPageData(
      docs.map(
        (p) => toListItem(p, urls) as unknown as Record<string, unknown>,
      ),
      {
        limit,
        page,
        total,
        totalPages: Math.ceil(total / limit),
      },
    );
  }

  async create(
    dto: CreateProductDto,
    admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    await this.assertCategoryExists(dto.categoryId, dto.subcategoryId);
    const definitions = await this.filterService.listActive();
    const attributes = this.attributeValidator.validate(
      dto.attributes ?? {},
      definitions,
      dto.categoryId,
    );

    const slug = dto.slug ?? slugify(dto.name);
    if (await this.repository.countBySlug(slug)) {
      throw ApiException.conflict(
        ErrorCodes.PRODUCT_SLUG_EXISTS,
        'A product with this slug already exists.',
      );
    }
    if (dto.sku && (await this.repository.countBySku(dto.sku))) {
      throw ApiException.conflict(
        ErrorCodes.PRODUCT_SKU_EXISTS,
        'A product with this SKU already exists.',
      );
    }

    const isPublished = dto.status === 'published';
    const created = await this.repository.create({
      name: dto.name,
      slug,
      shortDescription: dto.shortDescription ?? '',
      description: dto.description ?? '',
      categoryId: new Types.ObjectId(dto.categoryId),
      subcategoryId: dto.subcategoryId
        ? new Types.ObjectId(dto.subcategoryId)
        : null,
      status: dto.status ?? 'draft',
      visibility: dto.visibility ?? 'public',
      featured: dto.featured ?? false,
      tags: dto.tags ?? [],
      sku: dto.sku ?? null,
      images: this.normalizeImages(dto.images ?? []),
      attributes: attributes.attributes,
      facets: attributes.facets,
      dimensions: dto.dimensions ?? { unit: 'cm' },
      moq: dto.moq ?? null,
      customizableProperties: dto.customizableProperties ?? null,
      seo: dto.seo ?? {},
      createdBy: new Types.ObjectId(admin.id),
      updatedBy: new Types.ObjectId(admin.id),
      publishedAt: isPublished ? new Date() : null,
      version: 1,
    });

    await this.cacheInvalidator.invalidateProducts();
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.PRODUCT_CREATED,
      resourceType: 'product',
      resourceId: String(created._id),
      after: { slug, status: created.status },
    });
    return { id: String(created._id) };
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw ApiException.notFound(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Product not found.',
      );
    }

    const next: Partial<Product> = {};
    if (dto.name !== undefined) next.name = dto.name;
    if (dto.categoryId !== undefined) {
      await this.assertCategoryExists(dto.categoryId, dto.subcategoryId);
      next.categoryId = new Types.ObjectId(dto.categoryId);
    }
    if (dto.subcategoryId !== undefined)
      next.subcategoryId = dto.subcategoryId
        ? new Types.ObjectId(dto.subcategoryId)
        : null;
    if (dto.shortDescription !== undefined)
      next.shortDescription = dto.shortDescription;
    if (dto.description !== undefined) next.description = dto.description;
    if (dto.visibility !== undefined) next.visibility = dto.visibility;
    if (dto.featured !== undefined) next.featured = dto.featured;
    if (dto.tags !== undefined) next.tags = dto.tags;
    if (dto.sku !== undefined) {
      if (await this.repository.countBySku(dto.sku, id)) {
        throw ApiException.conflict(
          ErrorCodes.PRODUCT_SKU_EXISTS,
          'A product with this SKU already exists.',
        );
      }
      next.sku = dto.sku ?? null;
    }
    if (dto.images !== undefined)
      next.images = this.normalizeImages(dto.images);
    if (dto.dimensions !== undefined) next.dimensions = dto.dimensions;
    if (dto.moq !== undefined) next.moq = dto.moq ?? null;
    if (dto.customizableProperties !== undefined)
      next.customizableProperties = dto.customizableProperties;
    if (dto.seo !== undefined) next.seo = dto.seo;

    if (dto.slug !== undefined) {
      if (await this.repository.countBySlug(dto.slug, id)) {
        throw ApiException.conflict(
          ErrorCodes.PRODUCT_SLUG_EXISTS,
          'A product with this slug already exists.',
        );
      }
      next.slug = dto.slug;
    }

    if (dto.attributes !== undefined) {
      const definitions = await this.filterService.listActive();
      const attributes = this.attributeValidator.validate(
        dto.attributes,
        definitions,
        dto.categoryId ?? existing.categoryId.toString(),
      );
      next.attributes = attributes.attributes;
      next.facets = attributes.facets;
    }

    const becomingPublished =
      dto.status === 'published' && existing.status !== 'published';
    if (dto.status !== undefined) next.status = dto.status;
    if (becomingPublished) next.publishedAt = new Date();
    if (dto.status === 'draft' && existing.status === 'published')
      next.publishedAt = null;

    next.updatedBy = new Types.ObjectId(admin.id);
    const updated = await this.repository.updateByIdVersioned(
      id,
      dto.version,
      next,
    );
    if (!updated) {
      throw ApiException.conflict(
        ErrorCodes.PRODUCT_VERSION_CONFLICT,
        'This product was modified by another user. Reload and retry.',
      );
    }

    await this.cacheInvalidator.invalidateProducts();
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.PRODUCT_UPDATED,
      resourceType: 'product',
      resourceId: id,
      after: {
        slug: updated.slug,
        status: updated.status,
        version: updated.version,
      },
    });
    return { id, version: updated.version };
  }

  async publish(
    id: string,
    admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    const product = await this.repository.findById(id);
    if (!product)
      throw ApiException.notFound(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Product not found.',
      );
    if (product.status === 'published') {
      throw ApiException.conflict(
        ErrorCodes.PRODUCT_ALREADY_PUBLISHED,
        'Product is already published.',
      );
    }
    const updated = await this.repository.updateByIdVersioned(
      id,
      product.version,
      {
        status: 'published',
        publishedAt: new Date(),
        updatedBy: new Types.ObjectId(admin.id),
      },
    );
    if (!updated) {
      throw ApiException.conflict(
        ErrorCodes.PRODUCT_VERSION_CONFLICT,
        'Product was modified concurrently. Reload and try again.',
      );
    }
    await this.cacheInvalidator.invalidateProducts();
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.PRODUCT_PUBLISHED,
      resourceType: 'product',
      resourceId: id,
    });
    return { id, status: updated?.status };
  }

  async unpublish(
    id: string,
    admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    const product = await this.repository.findById(id);
    if (!product)
      throw ApiException.notFound(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Product not found.',
      );
    if (product.status !== 'published') {
      throw ApiException.invalid(
        ErrorCodes.PRODUCT_NOT_PUBLISHED,
        'Product is not published.',
      );
    }
    const updated = await this.repository.updateByIdVersioned(
      id,
      product.version,
      {
        status: 'draft',
        publishedAt: null,
        updatedBy: new Types.ObjectId(admin.id),
      },
    );
    if (!updated) {
      throw ApiException.conflict(
        ErrorCodes.PRODUCT_VERSION_CONFLICT,
        'Product was modified concurrently. Reload and try again.',
      );
    }
    await this.cacheInvalidator.invalidateProducts();
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.PRODUCT_UNPUBLISHED,
      resourceType: 'product',
      resourceId: id,
    });
    return { id, status: 'draft' };
  }

  async remove(id: string, admin: AdminPrincipal): Promise<void> {
    if (!(await this.repository.findById(id))) {
      throw ApiException.notFound(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Product not found.',
      );
    }
    await this.repository.softDelete(id, admin.id);
    await this.cacheInvalidator.invalidateProducts();
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.PRODUCT_DELETED,
      resourceType: 'product',
      resourceId: id,
    });
  }

  async restore(
    id: string,
    admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    const restored = await this.repository.restore(id, admin.id);
    if (!restored)
      throw ApiException.notFound(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Product not found or not deleted.',
      );
    await this.cacheInvalidator.invalidateProducts();
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.PRODUCT_RESTORED,
      resourceType: 'product',
      resourceId: id,
    });
    return { id, restored: true };
  }

  async bulkDelete(
    ids: string[],
    admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    const count = await this.repository.softDeleteMany(ids, admin.id);
    await this.cacheInvalidator.invalidateProducts();
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.PRODUCT_BULK_DELETE,
      resourceType: 'product',
      resourceId: ids.join(','),
      after: { count },
    });
    return { deleted: count };
  }

  async bulkUpdate(
    ids: string[],
    updates: { status?: string; visibility?: string; featured?: boolean },
    admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    const data: Partial<Product> = { updatedBy: new Types.ObjectId(admin.id) };
    if (updates.status !== undefined)
      data.status = updates.status as Product['status'];
    if (updates.visibility !== undefined)
      data.visibility = updates.visibility as Product['visibility'];
    if (updates.featured !== undefined) data.featured = updates.featured;
    const count = await this.repository.bulkUpdateMany(ids, data);
    await this.cacheInvalidator.invalidateProducts();
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.PRODUCT_BULK_UPDATE,
      resourceType: 'product',
      resourceId: ids.join(','),
      after: { count },
    });
    return { updated: count };
  }

  private async buildPublicMatch(
    query: PublicListProductQueryDto,
  ): Promise<Record<string, unknown>> {
    const match: Record<string, unknown> = {
      status: 'published',
      visibility: 'public',
      deletedAt: null,
    };
    if (query.category) {
      const category = await this.categoryRepository.findActiveBySlug(
        query.category,
      );
      if (!category)
        throw ApiException.notFound(
          ErrorCodes.CATEGORY_NOT_FOUND,
          'Category not found.',
        );
      match.categoryId = category._id;
      if (query.subcategory) {
        const subcategory = await this.categoryRepository.findActiveBySlug(
          query.subcategory,
        );
        if (
          !subcategory ||
          !subcategory.parentId ||
          subcategory.parentId.toString() !== category._id.toString()
        ) {
          throw ApiException.notFound(
            ErrorCodes.CATEGORY_NOT_FOUND,
            'Subcategory not found for this category.',
          );
        }
        match.subcategoryId = subcategory._id;
      }
    }
    if (query.search) {
      const text = this.searchService.buildQuery({ text: query.search });
      if (text) Object.assign(match, text);
    }
    if (query.tags)
      match.tags = {
        $all: query.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
    return match;
  }

  private parseSort(raw: string | undefined): Record<string, 1 | -1> {
    if (!raw) return { createdAt: -1, _id: -1 };
    const sortMap: Record<string, Record<string, 1 | -1>> = {
      '-createdAt': { createdAt: -1, _id: -1 },
      createdAt: { createdAt: 1, _id: 1 },
      '-updatedAt': { updatedAt: -1, _id: -1 },
      updatedAt: { updatedAt: 1, _id: 1 },
      '-name': { name: -1, _id: -1 },
      name: { name: 1, _id: 1 },
      '-publishedAt': { publishedAt: -1, _id: -1 },
      publishedAt: { publishedAt: 1, _id: 1 },
      '-featured': { featured: -1, publishedAt: -1, _id: -1 },
      featured: { featured: -1, publishedAt: -1, _id: -1 },
    };
    const sort = sortMap[raw];
    if (!sort)
      throw ApiException.invalid(
        ErrorCodes.UNSUPPORTED_SORT_FIELD,
        `Sort field "${raw}" is not supported.`,
        [{ field: 'sort' }],
      );
    return sort;
  }

  private primarySortField(sort: Record<string, 1 | -1>): string {
    return Object.keys(sort)[0];
  }

  private cursorFilter(
    decoded: unknown[],
    sort: Record<string, 1 | -1>,
  ): Record<string, unknown> | null {
    const field = this.primarySortField(sort);
    const [fieldValue, idValue] = decoded;
    if (
      fieldValue === undefined ||
      typeof idValue !== 'string' ||
      !/^[a-f\d]{24}$/i.test(idValue)
    ) {
      throw ApiException.invalid(
        ErrorCodes.INVALID_CURSOR,
        'Invalid pagination cursor.',
      );
    }
    const dateFields = new Set(['createdAt', 'updatedAt', 'publishedAt']);
    const value: unknown =
      dateFields.has(field) && typeof fieldValue === 'string'
        ? new Date(fieldValue)
        : fieldValue;
    const dir = sort[field];
    const op = dir === -1 ? '$lt' : '$gt';
    const idOp = dir === -1 ? '$lt' : '$gt';
    return {
      $or: [
        { [field]: { [op]: value } },
        { [field]: value, _id: { [idOp]: new Types.ObjectId(idValue) } },
      ],
    };
  }

  private parseFilters(
    raw: string | undefined,
    definitions: FilterDefinition[],
  ): FacetFilter[] {
    if (!raw) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw ApiException.invalid(
        ErrorCodes.PRODUCT_VALIDATION_FAILED,
        'filters must be a valid JSON array.',
        [{ field: 'filters', message: 'Invalid JSON.' }],
      );
    }
    if (!Array.isArray(parsed)) {
      throw ApiException.invalid(
        ErrorCodes.PRODUCT_VALIDATION_FAILED,
        'filters must be an array.',
        [{ field: 'filters' }],
      );
    }
    const result: FacetFilter[] = [];
    for (const item of parsed) {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof (item as { key?: unknown }).key !== 'string' ||
        !('value' in (item as object))
      ) {
        throw ApiException.invalid(
          ErrorCodes.PRODUCT_VALIDATION_FAILED,
          'Each filter must have a key and a value.',
          [{ field: 'filters' }],
        );
      }
      const key = (item as { key: string }).key;
      const definition = definitions.find((d) => d.key === key);
      if (!definition) {
        throw ApiException.invalid(
          ErrorCodes.UNKNOWN_FILTER_KEY,
          `Unknown filter key "${key}".`,
          [{ field: 'filters' }],
        );
      }
      if (!definition.filterable) {
        throw ApiException.invalid(
          ErrorCodes.INVALID_ATTRIBUTE,
          `Filter "${key}" is not filterable.`,
          [{ field: 'filters' }],
        );
      }
      const values = Array.isArray((item as { value: unknown }).value)
        ? (item as { value: unknown[] }).value
        : [(item as { value: unknown }).value];
      result.push({
        key,
        values: values.map((v) => this.coerceFilterValue(definition, v)),
      });
    }
    return result;
  }

  private coerceFilterValue(
    definition: FilterDefinition,
    raw: unknown,
  ): string | number | boolean {
    switch (definition.dataType) {
      case 'number': {
        const value = Number(raw);
        if (!Number.isFinite(value))
          throw ApiException.invalid(
            ErrorCodes.PRODUCT_VALIDATION_FAILED,
            `Filter "${definition.key}" must be numeric.`,
            [{ field: 'filters' }],
          );
        return value;
      }
      case 'boolean':
        if (raw === true || raw === 'true' || raw === 1 || raw === '1')
          return true;
        if (raw === false || raw === 'false' || raw === 0 || raw === '0')
          return false;
        throw ApiException.invalid(
          ErrorCodes.PRODUCT_VALIDATION_FAILED,
          `Filter "${definition.key}" must be a boolean.`,
          [{ field: 'filters' }],
        );
      default:
        return String(raw).trim();
    }
  }

  private async buildFacets(
    match: Record<string, unknown>,
    definitions: FilterDefinition[],
  ): Promise<Array<Record<string, unknown>>> {
    const groups = await this.repository.aggregate<FacetAggregateItem>([
      { $match: match },
      { $unwind: '$facets' },
      {
        $group: {
          _id: { key: '$facets.key', value: '$facets.value' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);
    const byKey = new Map<string, Array<{ value: unknown; count: number }>>();
    for (const group of groups) {
      const key = String(group._id.key);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push({ value: group._id.value, count: group.count });
    }
    const facets: Array<Record<string, unknown>> = [];
    for (const definition of definitions) {
      if (!definition.filterable) continue;
      const counts = byKey.get(definition.key) ?? [];
      const options = counts.map((c) => ({
        value: c.value,
        label: String(c.value),
        count: c.count,
      }));
      facets.push({
        key: definition.key,
        label: definition.label,
        dataType: definition.dataType,
        multiple: definition.multiple,
        options,
      });
    }
    return facets;
  }

  private normalizeImages(images: ProductImage[]): ProductImage[] {
    if (!images || images.length === 0) return [];
    const normalized = images.map((image, index) => ({
      key: image.key,
      alt: image.alt ?? '',
      order: image.order ?? index,
      isMain: image.isMain ?? false,
    }));
    if (!normalized.some((i) => i.isMain)) normalized[0].isMain = true;
    return normalized;
  }

  private async assertCategoryExists(
    categoryId: string,
    subcategoryId?: string,
  ): Promise<void> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category)
      throw ApiException.notFound(
        ErrorCodes.CATEGORY_NOT_FOUND,
        'Category not found.',
      );
    if (subcategoryId) {
      const subcategory = await this.categoryRepository.findById(subcategoryId);
      if (
        !subcategory ||
        !subcategory.parentId ||
        subcategory.parentId.toString() !== category._id.toString()
      ) {
        throw ApiException.notFound(
          ErrorCodes.CATEGORY_NOT_FOUND,
          'Subcategory does not belong to the given category.',
        );
      }
    }
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async tryCache<T>(key: string): Promise<T | null> {
    try {
      return await this.cache.get<T>(key);
    } catch (error) {
      this.logger.warn('cache read failed, falling through to DB', {
        key,
        message: (error as Error).message,
      });
      return null;
    }
  }

  private readonly listProjection: Record<string, number> = {
    name: 1,
    slug: 1,
    shortDescription: 1,
    categoryId: 1,
    subcategoryId: 1,
    status: 1,
    visibility: 1,
    featured: 1,
    tags: 1,
    sku: 1,
    images: 1,
    publishedAt: 1,
    updatedAt: 1,
    version: 1,
    createdAt: 1,
  };
}

type ListPage = PagedData<unknown>;
