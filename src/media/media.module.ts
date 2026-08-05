import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';

import { Queues } from '../common/constants/queues';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { ImageProcessingProcessor } from './image-processing.processor';
import { MediaRepository } from './repositories/media.repository';
import { S3ObjectStorageService } from './storage/s3-object-storage.service';
import { Media, MediaSchema } from './schemas/media.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Media.name, schema: MediaSchema }]),
    BullModule.registerQueue({ name: Queues.imageProcessing }),
    AuditLogsModule,
  ],
  controllers: [MediaController],
  providers: [
    MediaService,
    MediaRepository,
    S3ObjectStorageService,
    ImageProcessingProcessor,
  ],
  exports: [MediaService, S3ObjectStorageService],
})
export class MediaModule {}
