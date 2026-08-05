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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { Permissions as PermissionList } from '../roles/permissions';

@ApiTags('admin-categories')
@ApiBearerAuth()
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Permissions(PermissionList.CATEGORIES_MANAGE)
  list(): Promise<Array<Record<string, unknown>>> {
    return this.categoriesService.listAdmin();
  }

  @Post()
  @Permissions(PermissionList.CATEGORIES_MANAGE)
  create(
    @Body() dto: CreateCategoryDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    return this.categoriesService.create(dto, admin.id);
  }

  @Patch(':id')
  @Permissions(PermissionList.CATEGORIES_MANAGE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    return this.categoriesService.update(id, dto, admin.id);
  }

  @Delete(':id')
  @Permissions(PermissionList.CATEGORIES_MANAGE)
  remove(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<void> {
    return this.categoriesService.remove(id, admin.id);
  }
}

@ApiTags('public-categories')
@Controller('categories')
export class PublicCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Public()
  list(): Promise<Array<Record<string, unknown>>> {
    return this.categoriesService.listPublic();
  }

  @Get(':slug')
  @Public()
  get(@Param('slug') slug: string): Promise<Record<string, unknown>> {
    return this.categoriesService.getPublicBySlug(slug);
  }
}
