import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CategoriesModule } from '../categories/categories.module';
import { FilterDefinitionsModule } from '../filter-definitions/filter-definitions.module';
import { MediaModule } from '../media/media.module';
import { SearchModule } from '../search/search.module';
import { ProductAttributeValidator } from './product-attribute.validator';
import { ProductsService } from './products.service';
import {
  AdminProductsController,
  PublicProductsController,
} from './products.controller';
import { ProductRepository } from './repositories/product.repository';
import { Product, ProductSchema } from './schemas/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    CategoriesModule,
    FilterDefinitionsModule,
    MediaModule,
    SearchModule,
    AuditLogsModule,
  ],
  controllers: [AdminProductsController, PublicProductsController],
  providers: [ProductsService, ProductRepository, ProductAttributeValidator],
  exports: [ProductsService],
})
export class ProductsModule {}
