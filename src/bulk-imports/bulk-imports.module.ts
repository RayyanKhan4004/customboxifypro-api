import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';

import { Queues } from '../common/constants/queues';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CategoriesModule } from '../categories/categories.module';
import { FilterDefinitionsModule } from '../filter-definitions/filter-definitions.module';
import { MediaModule } from '../media/media.module';
import { ProductsModule } from '../products/products.module';
import { BulkImportController } from './bulk-import.controller';
import { BulkImportService } from './bulk-import.service';
import { BulkImportProcessor } from './bulk-import.processor';
import { ImportParserService } from './import-parser.service';
import { BulkImportRepository } from './repositories/bulk-import.repository';
import { BulkImport, BulkImportSchema } from './schemas/bulk-import.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BulkImport.name, schema: BulkImportSchema },
    ]),
    BullModule.registerQueue({ name: Queues.bulkImport }),
    CategoriesModule,
    FilterDefinitionsModule,
    ProductsModule,
    MediaModule,
    AuditLogsModule,
  ],
  controllers: [BulkImportController],
  providers: [
    BulkImportService,
    BulkImportRepository,
    BulkImportProcessor,
    ImportParserService,
  ],
  exports: [BulkImportService],
})
export class BulkImportsModule {}
