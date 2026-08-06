import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ImageVariant {
  name: string;
  width: number;
}

@Injectable()
export class MediaConfig {
  readonly maxUploadSizeBytes: number;
  readonly allowedImageTypes: string[];
  readonly allowedImageExtensions: string[];
  readonly variants: ImageVariant[];

  constructor(private readonly config: ConfigService) {
    this.maxUploadSizeBytes = Number(config.get('MEDIA_MAX_UPLOAD_SIZE_BYTES'));
    this.allowedImageTypes = this.splitList(
      config.get('MEDIA_ALLOWED_IMAGE_TYPES'),
    );
    this.allowedImageExtensions = this.splitList(
      config.get('MEDIA_ALLOWED_IMAGE_EXTENSIONS'),
    );
    this.variants = this.parseVariants(
      config.get('IMAGE_VARIANT_SIZES') ?? 'thumbnail:240,small:480,medium:960,large:1600',
    );
  }

  private splitList(value: string | undefined): string[] {
    return (value ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  private parseVariants(value: string | undefined): ImageVariant[] {
    return (value ?? '')
      .split(',')
      .map((entry) => {
        const [name, width] = entry.trim().split(':');
        return { name, width: Number(width) };
      })
      .filter((v) => v.name && Number.isFinite(v.width) && v.width > 0);
  }
}
