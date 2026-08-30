import { Injectable } from '@nestjs/common';

import { AuditActions } from '../audit-logs/audit-actions';
import { AuditService } from '../audit-logs/audit.service';
import { ErrorCodes } from '../common/constants/error-codes';
import { ApiException } from '../common/exceptions/api.exception';
import { AppLogger } from '../common/logger/logger.service';
import { slugify } from '../common/utils/strings';
import { MediaService } from '../media/media.service';
import { CreateIndustryDto, UpdateIndustryDto } from './dto/industry.dto';
import { IndustryRepository } from './repositories/industry.repository';
import { IndustryDocument } from './schemas/industry.schema';

@Injectable()
export class IndustriesService {
  constructor(
    private readonly repository: IndustryRepository,
    private readonly mediaService: MediaService,
    private readonly audit: AuditService,
    private readonly logger: AppLogger,
  ) {}

  async listPublic(search?: string): Promise<Array<Record<string, unknown>>> {
    return this.toDto(await this.repository.listActive(search?.trim()));
  }

  async getPublicBySlug(slug: string): Promise<Record<string, unknown>> {
    const industry = await this.repository.findActiveBySlug(slug);
    if (!industry) {
      throw ApiException.notFound(
        ErrorCodes.INDUSTRY_NOT_FOUND,
        'Industry not found.',
      );
    }
    return (await this.toDto([industry]))[0];
  }

  async listAdmin(): Promise<Array<Record<string, unknown>>> {
    return this.toDto(await this.repository.listAll());
  }

  async create(
    dto: CreateIndustryDto,
    actorId: string,
  ): Promise<Record<string, unknown>> {
    const slug = slugify(dto.slug ?? dto.name);
    await this.assertAvailableSlug(slug);
    const created = await this.repository.create({
      name: dto.name,
      slug,
      description: dto.description ?? '',
      bestFor: dto.bestFor ?? '',
      specifications: dto.specifications ?? [],
      imageKey: dto.imageKey ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive === undefined ? true : dto.isActive === 'true',
    });
    await this.audit.log({
      actorId,
      action: AuditActions.INDUSTRY_CREATED,
      resourceType: 'industry',
      resourceId: String(created._id),
      after: { name: created.name, slug },
    });
    this.logger.info('industry created', { industryId: String(created._id) });
    return { id: String(created._id), slug };
  }

  async update(
    id: string,
    dto: UpdateIndustryDto,
    actorId: string,
  ): Promise<Record<string, unknown>> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw ApiException.notFound(
        ErrorCodes.INDUSTRY_NOT_FOUND,
        'Industry not found.',
      );
    }
    const patch: Record<string, unknown> = { ...dto };
    if (dto.slug) {
      const slug = slugify(dto.slug);
      await this.assertAvailableSlug(slug, id);
      patch.slug = slug;
    }
    if (dto.isActive !== undefined) patch.isActive = dto.isActive === 'true';
    await this.repository.update(id, patch);
    await this.audit.log({
      actorId,
      action: AuditActions.INDUSTRY_UPDATED,
      resourceType: 'industry',
      resourceId: id,
      after: patch,
    });
    return { id };
  }

  async remove(id: string, actorId: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw ApiException.notFound(
        ErrorCodes.INDUSTRY_NOT_FOUND,
        'Industry not found.',
      );
    }
    await this.repository.softDelete(id);
    await this.audit.log({
      actorId,
      action: AuditActions.INDUSTRY_DELETED,
      resourceType: 'industry',
      resourceId: id,
    });
  }

  private async assertAvailableSlug(
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    if (await this.repository.countBySlug(slug, excludeId)) {
      throw ApiException.conflict(
        ErrorCodes.INDUSTRY_SLUG_EXISTS,
        'An industry with this slug already exists.',
      );
    }
  }

  private async toDto(
    industries: IndustryDocument[],
  ): Promise<Array<Record<string, unknown>>> {
    const mediaUrls = await this.mediaService.resolveUrls(
      industries.map((industry) => industry.imageKey ?? ''),
    );
    return industries.map((industry) => ({
      id: String(industry._id),
      name: industry.name,
      slug: industry.slug,
      description: industry.description,
      bestFor: industry.bestFor,
      specifications: industry.specifications,
      imageKey: industry.imageKey,
      imageUrl: industry.imageKey ? mediaUrls[industry.imageKey]?.url ?? null : null,
      sortOrder: industry.sortOrder,
      isActive: industry.isActive,
    }));
  }
}
