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
import { ProductsService } from './products.service';
import {
  AdminListProductQueryDto,
  CreateProductDto,
  PublicListProductQueryDto,
  UpdateProductDto,
} from './dto/product.dto';

@ApiTags('admin-products')
@ApiBearerAuth()
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  @Permissions(PermissionList.PRODUCTS_READ)
  list(@Query() query: AdminListProductQueryDto) {
    return this.service.listAdmin(query);
  }

  @Get(':id')
  @Permissions(PermissionList.PRODUCTS_READ)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Permissions(PermissionList.PRODUCTS_CREATE)
  create(@Body() dto: CreateProductDto, @CurrentAdmin() admin: AdminPrincipal) {
    return this.service.create(dto, admin);
  }

  @Patch(':id')
  @Permissions(PermissionList.PRODUCTS_UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.service.update(id, dto, admin);
  }

  @Post(':id/publish')
  @Permissions(PermissionList.PRODUCTS_PUBLISH)
  publish(@Param('id') id: string, @CurrentAdmin() admin: AdminPrincipal) {
    return this.service.publish(id, admin);
  }

  @Post(':id/unpublish')
  @Permissions(PermissionList.PRODUCTS_PUBLISH)
  unpublish(@Param('id') id: string, @CurrentAdmin() admin: AdminPrincipal) {
    return this.service.unpublish(id, admin);
  }

  @Post('bulk/delete')
  @Permissions(PermissionList.PRODUCTS_DELETE)
  bulkDelete(
    @Body() dto: { ids: string[] },
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.service.bulkDelete(dto.ids, admin);
  }

  @Post('bulk/update')
  @Permissions(PermissionList.PRODUCTS_UPDATE)
  bulkUpdate(
    @Body()
    dto: {
      ids: string[];
      status?: string;
      visibility?: string;
      featured?: boolean;
    },
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.service.bulkUpdate(dto.ids, dto, admin);
  }

  @Post(':id/restore')
  @Permissions(PermissionList.PRODUCTS_RESTORE)
  restore(@Param('id') id: string, @CurrentAdmin() admin: AdminPrincipal) {
    return this.service.restore(id, admin);
  }

  @Delete(':id')
  @Permissions(PermissionList.PRODUCTS_DELETE)
  remove(@Param('id') id: string, @CurrentAdmin() admin: AdminPrincipal) {
    return this.service.remove(id, admin);
  }
}

@ApiTags('public-products')
@Controller('products')
export class PublicProductsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  @Public()
  list(@Query() query: PublicListProductQueryDto) {
    return this.service.listPublic(query);
  }

  @Get('filters')
  @Public()
  filters() {
    return this.service.listPublicFilters();
  }

  @Get(':slug')
  @Public()
  getBySlug(@Param('slug') slug: string) {
    return this.service.getBySlug(slug);
  }
}
