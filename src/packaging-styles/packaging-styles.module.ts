import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MediaModule } from '../media/media.module';
import { AdminPackagingStylesController, PublicPackagingStylesController } from './packaging-styles.controller';
import { PackagingStylesService } from './packaging-styles.service';
import { PackagingStyleRepository } from './repositories/packaging-style.repository';
import { PackagingStyle, PackagingStyleSchema } from './schemas/packaging-style.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: PackagingStyle.name, schema: PackagingStyleSchema }]), AuditLogsModule, MediaModule],
  controllers: [AdminPackagingStylesController, PublicPackagingStylesController],
  providers: [PackagingStylesService, PackagingStyleRepository],
})
export class PackagingStylesModule {}
