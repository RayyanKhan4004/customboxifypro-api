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

import { CurrentAdmin, Permissions } from '../common/decorators/decorators';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { AdminPagedData } from '../common/dto/pagination.types';
import { AdminsService } from './admins.service';
import {
  CreateAdminDto,
  InviteAdminDto,
  ListAdminsQuery,
  UpdateAdminDto,
} from './dto/admin.dto';
import { Permissions as PermissionList } from '../roles/permissions';

@ApiTags('admin-admins')
@ApiBearerAuth()
@Controller('admin/admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Get()
  @Permissions(PermissionList.ADMINS_READ)
  list(
    @Query() query: ListAdminsQuery,
  ): Promise<AdminPagedData<Record<string, unknown>>> {
    return this.adminsService.list(query);
  }

  @Post()
  @Permissions(PermissionList.ADMINS_INVITE)
  create(
    @Body() dto: CreateAdminDto,
    @CurrentAdmin() actor: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    return this.adminsService.create(dto, actor);
  }

  @Post('invite')
  @Permissions(PermissionList.ADMINS_INVITE)
  invite(
    @Body() dto: InviteAdminDto,
    @CurrentAdmin() actor: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    return this.adminsService.invite(dto, actor);
  }

  @Get(':id')
  @Permissions(PermissionList.ADMINS_READ)
  get(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.adminsService.get(id);
  }

  @Patch(':id')
  @Permissions(PermissionList.ADMINS_UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAdminDto,
    @CurrentAdmin() actor: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    return this.adminsService.update(id, dto, actor);
  }

  @Delete(':id')
  @Permissions(PermissionList.ADMINS_UPDATE)
  remove(
    @Param('id') id: string,
    @CurrentAdmin() actor: AdminPrincipal,
  ): Promise<void> {
    return this.adminsService.remove(id, actor);
  }
}
