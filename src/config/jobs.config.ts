import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JobsConfig {
  readonly bulkImportMaxFileSizeBytes: number;
  readonly bulkImportMaxRows: number;
  readonly bulkImportBatchSize: number;
  readonly bulkImportConcurrency: number;
  readonly bulkImportZipMaxSizeBytes: number;
  readonly bulkImportZipMaxFiles: number;
  readonly bulkImportZipMaxRatio: number;
  readonly imageConcurrency: number;
  readonly cleanupConcurrency: number;
  readonly notificationConcurrency: number;

  constructor(private readonly config: ConfigService) {
    this.bulkImportMaxFileSizeBytes = Number(
      config.get('BULK_IMPORT_MAX_FILE_SIZE_BYTES'),
    );
    this.bulkImportMaxRows = Number(config.get('BULK_IMPORT_MAX_ROWS'));
    this.bulkImportBatchSize = Number(config.get('BULK_IMPORT_BATCH_SIZE'));
    this.bulkImportConcurrency = Number(config.get('BULK_IMPORT_CONCURRENCY'));
    this.bulkImportZipMaxSizeBytes = Number(
      config.get('BULK_IMPORT_ZIP_MAX_SIZE_BYTES'),
    );
    this.bulkImportZipMaxFiles = Number(
      config.get('BULK_IMPORT_ZIP_MAX_FILES'),
    );
    this.bulkImportZipMaxRatio = Number(
      config.get('BULK_IMPORT_ZIP_MAX_RATIO'),
    );
    this.imageConcurrency = Number(config.get('JOBS_IMAGE_CONCURRENCY'));
    this.cleanupConcurrency = Number(config.get('JOBS_CLEANUP_CONCURRENCY'));
    this.notificationConcurrency = Number(
      config.get('JOBS_NOTIFICATION_CONCURRENCY'),
    );
  }
}
