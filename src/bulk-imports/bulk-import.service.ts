import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import { Queue } from 'bullmq';

import { CacheService } from '../cache/cache.service';
import { CacheInvalidationService } from '../cache/cache-invalidation.service';
import { AuditService } from '../audit-logs/audit.service';
import { AuditActions } from '../audit-logs/audit-actions';
import { ErrorCodes } from '../common/constants/error-codes';
import { ApiException } from '../common/exceptions/api.exception';
import { AdminPagedData, adminPageData } from '../common/dto/pagination.types';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { AppLogger } from '../common/logger/logger.service';
import { slugify } from '../common/utils/strings';
import { Queues } from '../common/constants/queues';
import { JobsConfig } from '../config/jobs.config';
import { CategoryRepository } from '../categories/repositories/category.repository';
import { FilterDefinitionsService } from '../filter-definitions/filter-definitions.service';
import { FilterDefinition } from '../filter-definitions/schemas/filter-definition.schema';
import { ProductAttributeValidator } from '../products/product-attribute.validator';
import { ProductRepository } from '../products/repositories/product.repository';
import { Product, ProductImage } from '../products/schemas/product.schema';
import { S3ObjectStorageService } from '../media/storage/s3-object-storage.service';
import { BulkImportRepository } from './repositories/bulk-import.repository';
import { ImportRowError } from './schemas/bulk-import.schema';
import { ImportParserService } from './import-parser.service';
import { ListBulkImportQueryDto } from './dto/bulk-import.dto';

const KNOWN_FIELDS = new Set([
  'name',
  'slug',
  'category',
  'subcategory',
  'shortDescription',
  'description',
  'status',
  'visibility',
  'featured',
  'tags',
  'sku',
  'moq',
  'images',
]);

interface RowBuildResult {
  ok: boolean;
  product?: Partial<Product>;
  error?: ImportRowError;
}

@Injectable()
export class BulkImportService {
  constructor(
    private readonly repository: BulkImportRepository,
    private readonly parser: ImportParserService,
    private readonly storage: S3ObjectStorageService,
    private readonly productRepository: ProductRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly filterService: FilterDefinitionsService,
    private readonly attributeValidator: ProductAttributeValidator,
    private readonly cache: CacheService,
    private readonly cacheInvalidator: CacheInvalidationService,
    private readonly audit: AuditService,
    private readonly jobsConfig: JobsConfig,
    private readonly logger: AppLogger,
    @InjectQueue(Queues.bulkImport) private readonly bulkQueue: Queue,
  ) {}

  async create(
    dto: { mode: 'draft' | 'all-or-nothing' },
    file: Express.Multer.File,
    admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    if (!file) {
      throw ApiException.invalid(
        ErrorCodes.IMPORT_INVALID_FILE,
        'No file was uploaded.',
        [{ field: 'file' }],
      );
    }
    if (file.size > this.jobsConfig.bulkImportMaxFileSizeBytes) {
      throw ApiException.invalid(
        ErrorCodes.IMPORT_TOO_LARGE,
        'File exceeds the allowed size limit.',
        [{ field: 'file' }],
      );
    }
    const key = `imports/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${this.extensionOf(file.originalname)}`;
    await this.storage.putObject(key, file.buffer, file.mimetype);

    const created = await this.repository.create({
      fileName: file.originalname,
      fileKey: key,
      mode: dto.mode,
      createdBy: new Types.ObjectId(admin.id),
      status: 'queued',
    });

    await this.bulkQueue.add('import', { importId: String(created._id) });
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.PRODUCT_IMPORT_STARTED,
      resourceType: 'bulk-import',
      resourceId: String(created._id),
      after: { fileName: file.originalname, mode: dto.mode },
    });
    return { id: String(created._id), status: 'queued' };
  }

  /** Stateless validation: parses and validates without importing anything. */
  async validate(file: Express.Multer.File): Promise<Record<string, unknown>> {
    if (!file) {
      throw ApiException.invalid(
        ErrorCodes.IMPORT_INVALID_FILE,
        'No file was uploaded.',
        [{ field: 'file' }],
      );
    }
    const parsed = await this.parser.parse(file.buffer, file.originalname);
    const categories = await this.categoryRepository.listAll();
    const defs = await this.filterService.listActive();
    const errors: ImportRowError[] = [];
    for (const row of parsed.rows) {
      const result = await this.buildProduct(
        row,
        parsed.images,
        categories,
        defs,
        new Set(),
        new Set(),
        false,
      );
      if (!result.ok) errors.push(result.error!);
    }
    return {
      valid: errors.length === 0,
      totalRows: parsed.rows.length,
      errorCount: errors.length,
      errors: errors.slice(0, 200),
    };
  }

  async list(
    query: ListBulkImportQueryDto,
  ): Promise<AdminPagedData<Record<string, unknown>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = { deletedAt: null };
    if (query.status) filter.status = query.status;
    const [items, total] = await Promise.all([
      this.repository.find(
        filter,
        { createdAt: -1 },
        limit,
        (page - 1) * limit,
      ),
      this.repository.count(filter),
    ]);
    return adminPageData(
      items.map((item) => ({
        ...item,
        _id: item._id.toString(),
        createdBy: item.createdBy.toString(),
      })),
      { limit, page, total, totalPages: Math.ceil(total / limit) },
    );
  }

  async findOne(id: string): Promise<Record<string, unknown>> {
    const doc = await this.repository.findById(id);
    if (!doc)
      throw ApiException.notFound(
        ErrorCodes.IMPORT_NOT_FOUND,
        'Import not found.',
      );
    return {
      ...doc,
      _id: doc._id.toString(),
      createdBy: doc.createdBy.toString(),
    };
  }

  async errors(id: string): Promise<Record<string, unknown>> {
    const doc = await this.repository.findById(id);
    if (!doc)
      throw ApiException.notFound(
        ErrorCodes.IMPORT_NOT_FOUND,
        'Import not found.',
      );
    return {
      errors: doc.rowErrors,
      errorCount: doc.errorCount,
      successCount: doc.successCount,
    };
  }

  async errorFile(id: string): Promise<string> {
    const doc = await this.repository.findById(id);
    if (!doc)
      throw ApiException.notFound(
        ErrorCodes.IMPORT_NOT_FOUND,
        'Import not found.',
      );
    const header = 'row,field,code,message';
    const lines = doc.rowErrors.map((e) =>
      [e.row ?? '', e.field ?? '', e.code, e.message]
        .map((cell) => this.csvEscape(cell))
        .join(','),
    );
    return [header, ...lines].join('\n');
  }

  async cancel(
    id: string,
    admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    const doc = await this.repository.findById(id);
    if (!doc)
      throw ApiException.notFound(
        ErrorCodes.IMPORT_NOT_FOUND,
        'Import not found.',
      );
    if (doc.status !== 'queued' && doc.status !== 'processing') {
      throw ApiException.conflict(
        ErrorCodes.IMPORT_CANNOT_CANCEL,
        `Import cannot be cancelled in state "${doc.status}".`,
      );
    }
    await this.repository.update(id, {
      status: 'cancelled',
      completedAt: new Date(),
    });
    await this.cache.set(this.cancelKey(id), '1');
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.PRODUCT_IMPORT_CANCELLED,
      resourceType: 'bulk-import',
      resourceId: id,
    });
    return { id, status: 'cancelled' };
  }

  async retry(
    id: string,
    admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    const doc = await this.repository.findById(id);
    if (!doc)
      throw ApiException.notFound(
        ErrorCodes.IMPORT_NOT_FOUND,
        'Import not found.',
      );
    if (doc.status !== 'failed' && doc.status !== 'cancelled') {
      throw ApiException.conflict(
        ErrorCodes.IMPORT_CANNOT_RETRY,
        `Import cannot be retried in state "${doc.status}".`,
      );
    }
    await this.repository.update(id, {
      status: 'queued',
      rowErrors: [],
      errorCount: 0,
      successCount: 0,
      processedRows: 0,
      totalRows: 0,
      completedAt: null,
    });
    await this.cache.del(this.cancelKey(id));
    await this.bulkQueue.add('import', { importId: id });
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.PRODUCT_IMPORT_RETRY,
      resourceType: 'bulk-import',
      resourceId: id,
    });
    return { id, status: 'queued' };
  }

  async template(): Promise<string> {
    const defs = await this.filterService.listActive();
    const attributeColumns = defs.map((d) => d.key);
    const header = [...KNOWN_FIELDS, ...attributeColumns];
    const sample = {
      name: 'Sample Kraft Mailer Box',
      slug: 'sample-kraft-mailer-box',
      category: 'mailer-boxes',
      subcategory: 'kraft-mailer-boxes',
      shortDescription: 'A sample box',
      description: 'Full description here',
      status: 'draft',
      visibility: 'public',
      featured: 'false',
      tags: 'kraft|eco',
      sku: 'SAMPLE-001',
      moq: '100',
      images: 'sample-1.jpg|sample-2.jpg',
    };
    const sampleRow = header.map(
      (column) => (sample as Record<string, string>)[column] ?? '',
    );
    return [header.join(','), sampleRow.join(',')].join('\n');
  }

  /** Worker entry point. Runs one import end-to-end with progress + cancellation. */
  async runImport(importId: string): Promise<void> {
    const doc = await this.repository.findById(importId);
    if (!doc || doc.status !== 'queued') return;

    await this.repository.update(importId, {
      status: 'processing',
      startedAt: new Date(),
    });
    const buffer = await this.storage.getObject(doc.fileKey);
    const parsed = await this.parser.parse(buffer, doc.fileName);
    await this.repository.update(importId, { totalRows: parsed.rows.length });

    const categories = await this.categoryRepository.listAll();
    const defs = await this.filterService.listActive();
    const usedSlugs = new Set<string>();
    const usedSkus = new Set<string>();
    const errors: ImportRowError[] = [];
    const validProducts: Array<{ product: Partial<Product>; row: number }> = [];

    for (let index = 0; index < parsed.rows.length; index += 1) {
      const result = await this.buildProduct(
        parsed.rows[index],
        parsed.images,
        categories,
        defs,
        usedSlugs,
        usedSkus,
        true,
      );
      if (result.ok) {
        validProducts.push({ product: result.product!, row: index + 2 });
      } else {
        errors.push({ ...result.error!, row: index + 2 });
        if (errors.length >= 500) break;
      }
    }

    if (doc.mode === 'all-or-nothing' && errors.length > 0) {
      await this.repository.update(importId, {
        status: 'failed',
        errorCount: errors.length,
        rowErrors: errors,
        completedAt: new Date(),
      });
      return;
    }

    let successCount = 0;
    const batchSize = this.jobsConfig.bulkImportBatchSize;
    for (let start = 0; start < validProducts.length; start += batchSize) {
      if (await this.cancelled(importId)) {
        await this.repository.update(importId, {
          status: 'cancelled',
          completedAt: new Date(),
        });
        return;
      }
      const batch = validProducts.slice(start, start + batchSize);
      const results = await Promise.allSettled(
        batch.map(({ product }) => this.productRepository.create(product)),
      );
      let batchSuccess = 0;
      results.forEach((result, offset) => {
        if (result.status === 'fulfilled') {
          batchSuccess += 1;
        } else {
          const message = (result.reason as Error)?.message ?? 'Unknown error';
          errors.push({
            row: batch[offset].row,
            code: ErrorCodes.PRODUCT_VALIDATION_FAILED,
            message: message.slice(0, 300),
          });
        }
      });
      successCount += batchSuccess;
      await this.repository.update(importId, {
        processedRows: Math.min(start + batch.length, validProducts.length),
        successCount,
        errorCount: errors.length,
        rowErrors: errors.slice(0, 500),
      });
    }

    await this.repository.update(importId, {
      status: 'completed',
      successCount,
      errorCount: errors.length,
      rowErrors: errors.slice(0, 500),
      processedRows: validProducts.length,
      completedAt: new Date(),
    });
    await this.cacheInvalidator.invalidateProducts();
    this.logger.info('bulk import completed', {
      importId,
      successCount,
      errorCount: errors.length,
    });
  }

  private async buildProduct(
    row: Record<string, string>,
    images: Map<string, Buffer>,
    categories: Array<{
      slug: string;
      _id: Types.ObjectId;
      parentId: Types.ObjectId | null;
    }>,
    defs: FilterDefinition[],
    usedSlugs: Set<string>,
    usedSkus: Set<string>,
    uploadImages: boolean,
  ): Promise<RowBuildResult> {
    const name = (row.name ?? '').trim();
    if (!name)
      return {
        ok: false,
        error: {
          field: 'name',
          code: ErrorCodes.PRODUCT_VALIDATION_FAILED,
          message: 'name is required.',
        },
      };

    const categorySlug = (row.category ?? '').trim().toLowerCase();
    const category = categories.find((c) => c.slug === categorySlug);
    if (!category) {
      return {
        ok: false,
        error: {
          field: 'category',
          code: ErrorCodes.CATEGORY_NOT_FOUND,
          message: `Category "${row.category}" not found.`,
        },
      };
    }
    let subcategoryId: Types.ObjectId | null = null;
    const subcategorySlug = (row.subcategory ?? '').trim().toLowerCase();
    if (subcategorySlug) {
      const subcategory = categories.find(
        (c) =>
          c.slug === subcategorySlug &&
          c.parentId &&
          c.parentId.toString() === category._id.toString(),
      );
      if (!subcategory) {
        return {
          ok: false,
          error: {
            field: 'subcategory',
            code: ErrorCodes.CATEGORY_NOT_FOUND,
            message: `Subcategory "${row.subcategory}" not found under "${categorySlug}".`,
          },
        };
      }
      subcategoryId = subcategory._id;
    }

    let slug = (row.slug ?? '').trim().toLowerCase();
    if (!slug) slug = slugify(name);
    if (usedSlugs.has(slug))
      return {
        ok: false,
        error: {
          field: 'slug',
          code: ErrorCodes.PRODUCT_SLUG_EXISTS,
          message: `Duplicate slug "${slug}" in file.`,
        },
      };
    usedSlugs.add(slug);

    const sku: string | null = (row.sku ?? '').trim() || null;
    if (sku) {
      if (usedSkus.has(sku))
        return {
          ok: false,
          error: {
            field: 'sku',
            code: ErrorCodes.PRODUCT_SKU_EXISTS,
            message: `Duplicate SKU "${sku}" in file.`,
          },
        };
      usedSkus.add(sku);
    }

    const attributesInput: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (KNOWN_FIELDS.has(key) || value === '') continue;
      const definition = defs.find((d) => d.key === key);
      if (definition && definition.dataType === 'multiselect') {
        attributesInput[key] = value
          .split('|')
          .map((v) => v.trim())
          .filter(Boolean);
      } else {
        attributesInput[key] = value;
      }
    }
    let attributes: Map<string, unknown>;
    let facets: Array<{ key: string; value: string | number | boolean }>;
    try {
      const validated = this.attributeValidator.validate(
        attributesInput,
        defs,
        category._id.toString(),
      );
      attributes = validated.attributes;
      facets = validated.facets;
    } catch (error) {
      return {
        ok: false,
        error: {
          field: 'attributes',
          code: ErrorCodes.PRODUCT_VALIDATION_FAILED,
          message: (error as Error).message,
        },
      };
    }

    const status = ['published', 'archived'].includes((row.status ?? '').trim())
      ? (row.status.trim() as Product['status'])
      : 'draft';
    const featured = ['true', '1'].includes(
      (row.featured ?? '').trim().toLowerCase(),
    );
    const tags = (row.tags ?? '')
      .split('|')
      .map((t) => t.trim())
      .filter(Boolean);
    const moq = (row.moq ?? '').trim() ? Number(row.moq) : null;

    const product: Partial<Product> = {
      name,
      slug,
      shortDescription: (row.shortDescription ?? '').trim(),
      description: (row.description ?? '').trim(),
      categoryId: category._id,
      subcategoryId,
      status,
      visibility: 'public',
      featured,
      tags,
      sku,
      moq,
      attributes,
      facets,
      images: [],
      publishedAt: status === 'published' ? new Date() : null,
      version: 1,
    };

    const imageRefs = (row.images ?? '')
      .split('|')
      .map((v) => v.trim())
      .filter(Boolean);
    if (uploadImages && imageRefs.length > 0) {
      const productImages: ProductImage[] = [];
      const uploadedKeys =
        images.size > 0
          ? await this.uploadZipImages(imageRefs, images)
          : imageRefs;
      for (const key of uploadedKeys) {
        productImages.push({
          key,
          alt: '',
          order: productImages.length,
          isMain: productImages.length === 0,
        });
      }
      product.images = productImages;
    }

    return { ok: true, product };
  }

  /** Uploads ZIP image files referenced by the images column to R2. */
  private async uploadZipImages(
    refs: string[],
    images: Map<string, Buffer>,
  ): Promise<string[]> {
    const keys: string[] = [];
    for (const ref of refs) {
      const buffer = images.get(ref.toLowerCase());
      if (!buffer) continue;
      const safeName = ref.replace(/[^a-z0-9._-]/gi, '_');
      const key = `imports/images/${randomUUID()}/${safeName}`;
      await this.storage.putObject(key, buffer, 'application/octet-stream');
      keys.push(key);
    }
    return keys;
  }

  private async cancelled(importId: string): Promise<boolean> {
    return this.cache.exists(this.cancelKey(importId));
  }

  private cancelKey(importId: string): string {
    return `import:cancel:${importId}`;
  }

  private extensionOf(fileName: string): string {
    return fileName.split('.').pop()?.toLowerCase() ?? '';
  }

  private csvEscape(value: string | number | undefined): string {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }
}
