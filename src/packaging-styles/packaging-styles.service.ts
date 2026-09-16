import { Injectable } from '@nestjs/common';

import { AuditActions } from '../audit-logs/audit-actions';
import { AuditService } from '../audit-logs/audit.service';
import { ErrorCodes } from '../common/constants/error-codes';
import { ApiException } from '../common/exceptions/api.exception';
import { AppLogger } from '../common/logger/logger.service';
import { slugify } from '../common/utils/strings';
import { MediaService } from '../media/media.service';
import {
  CreatePackagingStyleDto,
  UpdatePackagingStyleDto,
} from './dto/packaging-style.dto';
import { PackagingStyleRepository } from './repositories/packaging-style.repository';
import { PackagingStyleDocument } from './schemas/packaging-style.schema';

@Injectable()
export class PackagingStylesService {
  constructor(
    private readonly repository: PackagingStyleRepository,
    private readonly mediaService: MediaService,
    private readonly audit: AuditService,
    private readonly logger: AppLogger,
  ) {}

  async listPublic(search?: string): Promise<Array<Record<string, unknown>>> {
    return this.toDto(await this.repository.listActive(search?.trim()));
  }

  async listAdmin(): Promise<Array<Record<string, unknown>>> {
    return this.toDto(await this.repository.listAll());
  }

  async create(
    dto: CreatePackagingStyleDto,
    actorId: string,
  ): Promise<Record<string, unknown>> {
    const slug = slugify(dto.slug ?? dto.name);
    await this.assertAvailableSlug(slug);
    const created = await this.repository.create({
      name: dto.name.trim(),
      slug,
      description: dto.description?.trim() ?? '',
      imageKey: dto.imageKey?.trim() || null,
      minimumOrderQuantity: dto.minimumOrderQuantity ?? null,
      deliveryTime: dto.deliveryTime?.trim() || 'Delivery 2 weeks',
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive === undefined ? true : dto.isActive === 'true',
    });
    await this.audit.log({
      actorId,
      action: AuditActions.PACKAGING_STYLE_CREATED,
      resourceType: 'packaging-style',
      resourceId: String(created._id),
      after: { name: created.name, slug },
    });
    this.logger.info('packaging style created', {
      packagingStyleId: String(created._id),
    });
    return { id: String(created._id), slug };
  }

  async update(
    id: string,
    dto: UpdatePackagingStyleDto,
    actorId: string,
  ): Promise<Record<string, unknown>> {
    const existing = await this.repository.findById(id);
    if (!existing)
      throw ApiException.notFound(
        ErrorCodes.PACKAGING_STYLE_NOT_FOUND,
        'Packaging style not found.',
      );
    const patch: Record<string, unknown> = { ...dto };
    if (dto.slug) {
      const slug = slugify(dto.slug);
      await this.assertAvailableSlug(slug, id);
      patch.slug = slug;
    }
    if (dto.name) patch.name = dto.name.trim();
    if (dto.description !== undefined)
      patch.description = dto.description.trim();
    if (dto.imageKey !== undefined)
      patch.imageKey = dto.imageKey.trim() || null;
    if (dto.deliveryTime !== undefined)
      patch.deliveryTime = dto.deliveryTime.trim() || 'Delivery 2 weeks';
    if (dto.isActive !== undefined) patch.isActive = dto.isActive === 'true';
    await this.repository.update(id, patch);
    await this.audit.log({
      actorId,
      action: AuditActions.PACKAGING_STYLE_UPDATED,
      resourceType: 'packaging-style',
      resourceId: id,
      after: patch,
    });
    return { id };
  }

  async remove(id: string, actorId: string): Promise<void> {
    if (!(await this.repository.findById(id)))
      throw ApiException.notFound(
        ErrorCodes.PACKAGING_STYLE_NOT_FOUND,
        'Packaging style not found.',
      );
    await this.repository.softDelete(id);
    await this.audit.log({
      actorId,
      action: AuditActions.PACKAGING_STYLE_DELETED,
      resourceType: 'packaging-style',
      resourceId: id,
    });
  }

  private async assertAvailableSlug(
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    if (await this.repository.countBySlug(slug, excludeId))
      throw ApiException.conflict(
        ErrorCodes.PACKAGING_STYLE_SLUG_EXISTS,
        'A packaging style with this slug already exists.',
      );
  }

  private async toDto(
    styles: PackagingStyleDocument[],
  ): Promise<Array<Record<string, unknown>>> {
    const urls = await this.mediaService.resolveUrls(
      styles.map((style) => style.imageKey ?? ''),
    );
    return styles.map((style) => ({
      id: String(style._id),
      name: style.name,
      slug: style.slug,
      description: style.description,
      imageKey: style.imageKey,
      imageUrl: style.imageKey ? (urls[style.imageKey]?.url ?? null) : null,
      minimumOrderQuantity: style.minimumOrderQuantity,
      deliveryTime: style.deliveryTime,
      sortOrder: style.sortOrder,
      isActive: style.isActive,
    }));
  }
}
