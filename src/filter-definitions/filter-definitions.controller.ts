import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import {
  CurrentAdmin,
  Permissions,
  Public,
} from '../common/decorators/decorators';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { FilterDefinitionsService } from './filter-definitions.service';
import {
  CreateFilterDefinitionDto,
  UpdateFilterDefinitionDto,
} from './dto/filter-definition.dto';
import { Permissions as PermissionList } from '../roles/permissions';

@ApiTags('admin-filters')
@ApiBearerAuth()
@Controller('admin/filters')
export class AdminFilterDefinitionsController {
  constructor(private readonly service: FilterDefinitionsService) {}

  @Get()
  @Permissions(PermissionList.FILTERS_MANAGE)
  list(): Promise<Array<Record<string, unknown>>> {
    return this.service.listAdmin();
  }

  @Post()
  @Permissions(PermissionList.FILTERS_MANAGE)
  create(
    @Body() dto: CreateFilterDefinitionDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    return this.service.create(dto, admin.id);
  }

  @Patch(':id')
  @Permissions(PermissionList.FILTERS_MANAGE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFilterDefinitionDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    return this.service.update(id, dto, admin.id);
  }

  @Delete(':id')
  @Permissions(PermissionList.FILTERS_MANAGE)
  remove(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<void> {
    return this.service.remove(id, admin.id);
  }
}

@ApiTags('public-filters')
@Controller('filters')
export class PublicFilterDefinitionsController {
  constructor(private readonly service: FilterDefinitionsService) {}

  @Get()
  @Public()
  list(): Promise<Array<Record<string, unknown>>> {
    return this.service.listPublic();
  }

  @Get('editor')
  @Public()
  listForEditor(): Promise<Array<Record<string, unknown>>> {
    return this.service.listForEditor();
  }
}
