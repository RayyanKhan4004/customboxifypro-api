import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

import { AppLogger } from '../common/logger/logger.service';
import { MediaConfig } from '../config/media.config';
import { MediaRepository } from './repositories/media.repository';
import { S3ObjectStorageService } from './storage/s3-object-storage.service';

@Injectable()
export class ImageProcessingService {
  constructor(
    private readonly storage: S3ObjectStorageService,
    private readonly mediaRepository: MediaRepository,
    private readonly mediaConfig: MediaConfig,
    private readonly logger: AppLogger,
  ) {}

  async process(mediaId: string, key: string): Promise<void> {
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
