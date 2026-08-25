import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentAdmin, Permissions, Public } from '../common/decorators/decorators';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { Permissions as PermissionList } from '../roles/permissions';
import { CreateIndustryDto, UpdateIndustryDto } from './dto/industry.dto';
import { IndustriesService } from './industries.service';

@ApiTags('admin-industries')
@ApiBearerAuth()
@Controller('admin/industries')
export class AdminIndustriesController {
  constructor(private readonly industriesService: IndustriesService) {}

  @Get()
  @Permissions(PermissionList.SETTINGS_MANAGE)
  list(): Promise<Array<Record<string, unknown>>> { return this.industriesService.listAdmin(); }

  @Post()
  @Permissions(PermissionList.SETTINGS_MANAGE)
  create(@Body() dto: CreateIndustryDto, @CurrentAdmin() admin: AdminPrincipal): Promise<Record<string, unknown>> {
    return this.industriesService.create(dto, admin.id);
  }

  @Patch(':id')
  @Permissions(PermissionList.SETTINGS_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateIndustryDto, @CurrentAdmin() admin: AdminPrincipal): Promise<Record<string, unknown>> {
    return this.industriesService.update(id, dto, admin.id);
  }

  @Delete(':id')
  @Permissions(PermissionList.SETTINGS_MANAGE)
  remove(@Param('id') id: string, @CurrentAdmin() admin: AdminPrincipal): Promise<void> {
    return this.industriesService.remove(id, admin.id);
  }
}

@ApiTags('public-industries')
@Controller('industries')
export class PublicIndustriesController {
  constructor(private readonly industriesService: IndustriesService) {}

  @Get()
  @Public()
  list(): Promise<Array<Record<string, unknown>>> { return this.industriesService.listPublic(); }

  @Get(':slug')
  @Public()
  get(@Param('slug') slug: string): Promise<Record<string, unknown>> { return this.industriesService.getPublicBySlug(slug); }
}
