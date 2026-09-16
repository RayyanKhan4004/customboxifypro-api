import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import {
  CurrentAdmin,
  Permissions,
  Public,
} from '../common/decorators/decorators';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { Permissions as PermissionList } from '../roles/permissions';
import {
  CreatePackagingStyleDto,
  ListPublicPackagingStylesQueryDto,
  UpdatePackagingStyleDto,
} from './dto/packaging-style.dto';
import { PackagingStylesService } from './packaging-styles.service';

@ApiTags('admin-packaging-styles')
@ApiBearerAuth()
@Controller('admin/packaging-styles')
export class AdminPackagingStylesController {
  constructor(private readonly service: PackagingStylesService) {}

  @Get()
  @Permissions(PermissionList.SETTINGS_MANAGE)
  list(): Promise<Array<Record<string, unknown>>> {
    return this.service.listAdmin();
  }

  @Post()
  @Permissions(PermissionList.SETTINGS_MANAGE)
  create(
    @Body() dto: CreatePackagingStyleDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    return this.service.create(dto, admin.id);
  }

  @Patch(':id')
  @Permissions(PermissionList.SETTINGS_MANAGE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePackagingStyleDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    return this.service.update(id, dto, admin.id);
  }

  @Delete(':id')
  @Permissions(PermissionList.SETTINGS_MANAGE)
  remove(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<void> {
    return this.service.remove(id, admin.id);
  }
}

@ApiTags('public-packaging-styles')
@Controller('packaging-styles')
export class PublicPackagingStylesController {
  constructor(private readonly service: PackagingStylesService) {}

  @Get()
  @Public()
  list(
    @Query() query: ListPublicPackagingStylesQueryDto,
  ): Promise<Array<Record<string, unknown>>> {
    return this.service.listPublic(query.search);
  }
}
