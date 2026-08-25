import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AdminIndustriesController, PublicIndustriesController } from './industries.controller';
import { IndustriesService } from './industries.service';
import { IndustryRepository } from './repositories/industry.repository';
import { Industry, IndustrySchema } from './schemas/industry.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Industry.name, schema: IndustrySchema }]), AuditLogsModule],
  controllers: [AdminIndustriesController, PublicIndustriesController],
  providers: [IndustriesService, IndustryRepository],
})
export class IndustriesModule {}
