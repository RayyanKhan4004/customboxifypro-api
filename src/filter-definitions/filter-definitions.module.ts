import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import {
  AdminFilterDefinitionsController,
  PublicFilterDefinitionsController,
} from './filter-definitions.controller';
import { FilterDefinitionsService } from './filter-definitions.service';
import { FilterDefinitionRepository } from './repositories/filter-definition.repository';
import {
  FilterDefinition,
  FilterDefinitionSchema,
} from './schemas/filter-definition.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FilterDefinition.name, schema: FilterDefinitionSchema },
    ]),
    AuditLogsModule,
  ],
  controllers: [
    AdminFilterDefinitionsController,
    PublicFilterDefinitionsController,
  ],
  providers: [FilterDefinitionsService, FilterDefinitionRepository],
  exports: [FilterDefinitionsService, FilterDefinitionRepository],
})
export class FilterDefinitionsModule {}
