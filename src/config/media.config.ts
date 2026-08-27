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
  readonly maxVideoUploadSizeBytes: number;
  readonly maxDocumentUploadSizeBytes: number;
  readonly allowedVideoTypes: string[];
  readonly allowedVideoExtensions: string[];
  readonly allowedDocumentTypes: string[];
  readonly allowedDocumentExtensions: string[];
  readonly variants: ImageVariant[];

  constructor(private readonly config: ConfigService) {
    this.maxUploadSizeBytes = Number(config.get('MEDIA_MAX_UPLOAD_SIZE_BYTES'));
    this.allowedImageTypes = this.splitList(
      config.get('MEDIA_ALLOWED_IMAGE_TYPES'),
    );
    this.allowedImageExtensions = this.splitList(
      config.get('MEDIA_ALLOWED_IMAGE_EXTENSIONS'),
    );
    this.maxVideoUploadSizeBytes = Number(
      config.get('MEDIA_MAX_VIDEO_UPLOAD_SIZE_BYTES', 104857600),
    );
    this.maxDocumentUploadSizeBytes = Number(
      config.get('MEDIA_MAX_DOCUMENT_UPLOAD_SIZE_BYTES', 26214400),
    );
    this.allowedVideoTypes = this.splitList(
      config.get(
        'MEDIA_ALLOWED_VIDEO_TYPES',
        'video/mp4,video/webm,video/quicktime',
      ),
    );
    this.allowedVideoExtensions = this.splitList(
      config.get('MEDIA_ALLOWED_VIDEO_EXTENSIONS', 'mp4,webm,mov'),
    );
    this.allowedDocumentTypes = this.splitList(
      config.get(
        'MEDIA_ALLOWED_DOCUMENT_TYPES',
        'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    );
    this.allowedDocumentExtensions = this.splitList(
      config.get('MEDIA_ALLOWED_DOCUMENT_EXTENSIONS', 'pdf,doc,docx'),
    );
    this.variants = this.parseVariants(
      config.get('IMAGE_VARIANT_SIZES') ??
        'thumbnail:240,small:480,medium:960,large:1600',
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
