import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import sharp from 'sharp';

import { Queues } from '../common/constants/queues';
import { AppLogger } from '../common/logger/logger.service';
import { MediaConfig } from '../config/media.config';
import { MediaRepository } from './repositories/media.repository';
import { S3ObjectStorageService } from './storage/s3-object-storage.service';

interface ImageProcessingJobData {
  mediaId: string;
  key: string;
}

/**
 * Generates configured image variants (sharp) and stores them in R2.
 * The full pipeline is: presign -> direct client upload -> complete ->
 * this job -> variants written -> media marked ready.
 */
@Processor(Queues.imageProcessing, { concurrency: 2 })
export class ImageProcessingProcessor extends WorkerHost {
  constructor(
    private readonly storage: S3ObjectStorageService,
    private readonly mediaRepository: MediaRepository,
    private readonly mediaConfig: MediaConfig,
    private readonly logger: AppLogger,
  ) {
    super();
  }

  async process(job: Job<ImageProcessingJobData>): Promise<void> {
    const { mediaId, key } = job.data;
    try {
      const buffer = await this.storage.getObject(key);
      const metadata = await sharp(buffer, { failOn: 'none' }).metadata();

      const variants: Record<string, string> = {};
      for (const variant of this.mediaConfig.variants) {
        const out = await sharp(buffer, { failOn: 'none' })
          .resize({ width: variant.width, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        const variantKey = `variants/${variant.name}/${key}`;
        await this.storage.putObject(variantKey, out, 'image/webp');
        variants[variant.name] = variantKey;
      }

      await this.mediaRepository.update(mediaId, {
        status: 'ready',
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        variants,
      });
      this.logger.info('image variants generated', { mediaId });
    } catch (error) {
      await this.mediaRepository.update(mediaId, { status: 'failed' });
      throw error;
    }
  }
}
