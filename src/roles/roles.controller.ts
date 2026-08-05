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

import { Permissions } from '../common/decorators/decorators';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { Permissions as PermissionList, ALL_PERMISSIONS } from './permissions';

@ApiTags('admin-roles')
@ApiBearerAuth()
@Controller('admin/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions(PermissionList.ROLES_MANAGE)
  list(): Promise<Array<Record<string, unknown>>> {
    return this.rolesService.list();
  }

  @Get('permissions')
  @Permissions(PermissionList.ROLES_MANAGE)
  permissions(): { permissions: string[] } {
    return { permissions: ALL_PERMISSIONS };
  }

  @Post()
  @Permissions(PermissionList.ROLES_MANAGE)
  create(@Body() dto: CreateRoleDto): Promise<Record<string, unknown>> {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @Permissions(PermissionList.ROLES_MANAGE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<Record<string, unknown>> {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions(PermissionList.ROLES_MANAGE)
  remove(@Param('id') id: string): Promise<void> {
    return this.rolesService.remove(id);
  }
}
