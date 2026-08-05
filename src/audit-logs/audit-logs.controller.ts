import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { adminPageData } from '../common/dto/pagination.types';
import { Permissions } from '../common/decorators/decorators';
import { AuditService } from './audit.service';
import { Permissions as PermissionList } from '../roles/permissions';

class ListAuditQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value || undefined)
  actorId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value || undefined)
  resourceType?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value || undefined)
  resourceId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value || undefined)
  action?: string;

  @IsOptional()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  to?: Date;
}

@ApiTags('admin-audit-logs')
@ApiBearerAuth()
@Controller('admin/audit-logs')
export class AuditLogsController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions(PermissionList.AUDIT_LOGS_READ)
  async list(@Query() query: ListAuditQuery) {
    const filter: Record<string, unknown> = {};
    if (query.actorId) filter.actorId = query.actorId;
    if (query.resourceType) filter.resourceType = query.resourceType;
    if (query.resourceId) filter.resourceId = query.resourceId;
    if (query.action) filter.action = query.action;
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      };
    }

    const { items, total } = await this.auditService.list(
      filter,
      query.page,
      query.limit,
    );
    const totalPages = Math.ceil(total / query.limit);

    return adminPageData(
      items.map((item) => ({
        id: String(item._id),
        actorId: item.actorId ? String(item.actorId) : null,
        actorType: item.actorType,
        action: item.action,
        resourceType: item.resourceType,
        resourceId: item.resourceId,
        ip: item.ip,
        requestId: item.requestId,
        createdAt: item.createdAt,
      })),
      { page: query.page, limit: query.limit, total, totalPages },
    );
  }
}
