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
      config.get('BULK_IMPORT_MAX_FILE_SIZE_BYTES') ?? 20971520,
    );
    this.bulkImportMaxRows = Number(
      config.get('BULK_IMPORT_MAX_ROWS') ?? 20000,
    );
    this.bulkImportBatchSize = Number(
      config.get('BULK_IMPORT_BATCH_SIZE') ?? 500,
    );
    this.bulkImportConcurrency = Number(
      config.get('BULK_IMPORT_CONCURRENCY') ?? 2,
    );
    this.bulkImportZipMaxSizeBytes = Number(
      config.get('BULK_IMPORT_ZIP_MAX_SIZE_BYTES') ?? 52428800,
    );
    this.bulkImportZipMaxFiles = Number(
      config.get('BULK_IMPORT_ZIP_MAX_FILES') ?? 500,
    );
    this.bulkImportZipMaxRatio = Number(
      config.get('BULK_IMPORT_ZIP_MAX_RATIO') ?? 100,
    );
    this.imageConcurrency = Number(config.get('JOBS_IMAGE_CONCURRENCY'));
    this.cleanupConcurrency = Number(
      config.get('JOBS_CLEANUP_CONCURRENCY') ?? 1,
    );
    this.notificationConcurrency = Number(
      config.get('JOBS_NOTIFICATION_CONCURRENCY') ?? 1,
    );
  }
}
