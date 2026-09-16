import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentAdmin, Permissions, Public } from '../common/decorators/decorators';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { Permissions as PermissionList } from '../roles/permissions';
import { UpdateHomePageDto } from './dto/home-page.dto';
import { HomePageService } from './home-page.service';

@ApiTags('admin-home-page')
@ApiBearerAuth()
@Controller('admin/home-page')
export class AdminHomePageController {
  constructor(private readonly service: HomePageService) {}
  @Get() @Permissions(PermissionList.SETTINGS_MANAGE)
  get(): Promise<UpdateHomePageDto> { return this.service.get(); }
  @Patch() @Permissions(PermissionList.SETTINGS_MANAGE)
  update(@Body() dto: UpdateHomePageDto, @CurrentAdmin() admin: AdminPrincipal): Promise<UpdateHomePageDto> { return this.service.update(dto, admin.id); }
}

@ApiTags('public-home-page')
@Controller('home-page')
export class PublicHomePageController {
  constructor(private readonly service: HomePageService) {}
  @Get() @Public()
  get(): Promise<UpdateHomePageDto> { return this.service.get(); }
}
