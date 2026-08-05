import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';

import { CacheInvalidationService } from '../cache/cache-invalidation.service';
import { ApiException } from '../common/exceptions/api.exception';
import { ErrorCodes } from '../common/constants/error-codes';
import { AppLogger } from '../common/logger/logger.service';
import { slugify } from '../common/utils/strings';
import { AuditService } from '../audit-logs/audit.service';
import { AuditActions } from '../audit-logs/audit-actions';
import { CategoryRepository } from './repositories/category.repository';
import { CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly repository: CategoryRepository,
    private readonly cacheInvalidator: CacheInvalidationService,
    private readonly audit: AuditService,
    private readonly logger: AppLogger,
  ) {}

  async listPublic(): Promise<Array<Record<string, unknown>>> {
    const categories = await this.repository.listActive();
    return this.toDto(categories);
  }

  async getPublicBySlug(slug: string): Promise<Record<string, unknown>> {
    const category = await this.repository.findActiveBySlug(slug);
    if (!category) {
      throw ApiException.notFound(
        ErrorCodes.CATEGORY_NOT_FOUND,
        'Category not found.',
      );
    }
    return this.toDto([category])[0];
  }

  async listAdmin(): Promise<Array<Record<string, unknown>>> {
    const categories = await this.repository.listAll();
    return this.toDto(categories);
  }

  async create(
    dto: CreateCategoryDto,
    actorId: string,
  ): Promise<Record<string, unknown>> {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    if (await this.repository.countBySlug(slug)) {
      throw ApiException.conflict(
        ErrorCodes.CATEGORY_SLUG_EXISTS,
        'A category with this slug already exists.',
      );
    }
    await this.assertParent(dto.parentId);

    const created = await this.repository.create({
      name: dto.name,
      slug,
      description: dto.description ?? '',
      parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive === undefined ? true : dto.isActive === 'true',
      imageKey: dto.imageKey ?? null,
    });

    await this.cacheInvalidator.invalidateCategories();
    await this.audit.log({
      actorId,
      action: AuditActions.CATEGORY_CREATED,
      resourceType: 'category',
      resourceId: String(created._id),
      after: { name: dto.name, slug },
    });
    this.logger.info('category created', { categoryId: String(created._id) });
    return { id: String(created._id), slug };
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    actorId: string,
  ): Promise<Record<string, unknown>> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw ApiException.notFound(
        ErrorCodes.CATEGORY_NOT_FOUND,
        'Category not found.',
      );
    }

    if (dto.slug) {
      const slug = slugify(dto.slug);
      if (await this.repository.countBySlug(slug, id)) {
        throw ApiException.conflict(
          ErrorCodes.CATEGORY_SLUG_EXISTS,
          'A category with this slug already exists.',
        );
      }
      dto.slug = slug;
    }
    if (dto.parentId) await this.assertParent(dto.parentId);

    const patch: Record<string, unknown> = { ...dto };
    if (dto.isActive !== undefined) patch.isActive = dto.isActive === 'true';

    await this.repository.update(id, patch);
    await this.cacheInvalidator.invalidateCategories();
    await this.audit.log({
      actorId,
      action: AuditActions.CATEGORY_UPDATED,
      resourceType: 'category',
      resourceId: id,
      after: patch,
    });
    return { id };
  }

  async remove(id: string, actorId: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw ApiException.notFound(
        ErrorCodes.CATEGORY_NOT_FOUND,
        'Category not found.',
      );
    }
    if ((await this.repository.countChildren(id)) > 0) {
      throw ApiException.conflict(
        ErrorCodes.CATEGORY_HAS_CHILDREN,
        'This category has subcategories and cannot be deleted.',
      );
    }
    await this.repository.softDelete(id);
    await this.cacheInvalidator.invalidateCategories();
    await this.audit.log({
      actorId,
      action: AuditActions.CATEGORY_DELETED,
      resourceType: 'category',
      resourceId: id,
    });
  }

  private async assertParent(parentId?: string): Promise<void> {
    if (!parentId) return;
    const parent = await this.repository.findById(parentId);
    if (!parent) {
      throw ApiException.notFound(
        ErrorCodes.CATEGORY_NOT_FOUND,
        'Parent category not found.',
      );
    }
  }

  private toDto(
    categories: CategoryDocument[],
  ): Array<Record<string, unknown>> {
    return categories.map((category) => ({
      id: String(category._id),
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId ? String(category.parentId) : null,
      imageKey: category.imageKey,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      seo: category.seo,
    }));
  }
}
