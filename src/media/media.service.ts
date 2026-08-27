import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import { Queue } from 'bullmq';

import { Queues } from '../common/constants/queues';
import { ErrorCodes } from '../common/constants/error-codes';
import { ApiException } from '../common/exceptions/api.exception';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { AppLogger } from '../common/logger/logger.service';
import { MediaConfig } from '../config/media.config';
import { R2Config } from '../config/r2.config';
import { RedisConfig } from '../config/redis.config';
import { AdminPagedData, adminPageData } from '../common/dto/pagination.types';
import { AuditService } from '../audit-logs/audit.service';
import { AuditActions } from '../audit-logs/audit-actions';
import { MediaUrlMap } from './storage/object-storage.interface';
import { S3ObjectStorageService } from './storage/s3-object-storage.service';
import { MediaRepository } from './repositories/media.repository';
import { MediaDocument } from './schemas/media.schema';
import { ImageProcessingService } from './image-processing.service';
import {
  CompleteUploadDto,
  ListMediaQueryDto,
  PresignMediaDto,
  UpdateMediaDto,
} from './dto/media.dto';

@Injectable()
export class MediaService {
  constructor(
    private readonly repository: MediaRepository,
    private readonly storage: S3ObjectStorageService,
    private readonly mediaConfig: MediaConfig,
    private readonly r2Config: R2Config,
    private readonly audit: AuditService,
    private readonly logger: AppLogger,
    private readonly redisConfig: RedisConfig,
    private readonly imageProcessing: ImageProcessingService,
    @InjectQueue(Queues.imageProcessing) private readonly imageQueue: Queue,
  ) {}

  async presignUpload(
    dto: PresignMediaDto,
    admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    this.validateUploadRequest(dto);

    const extension = this.extensionOf(dto.fileName);
    const key = `media/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${extension}`;
    const uploadId = randomUUID();

    const record = await this.repository.create({
      key,
      uploadId,
      originalName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      createdBy: new Types.ObjectId(admin.id),
    });

    const { url, method } = await this.storage.createPresignedUpload(
      key,
      dto.mimeType,
      dto.sizeBytes,
    );

    this.logger.info('media upload presigned', {
      mediaId: record._id.toString(),
    });
    return {
      mediaId: record._id.toString(),
      uploadId,
      key,
      url,
      method,
      expiresIn: this.r2Config.uploadExpiresIn,
    };
  }

  async completeUpload(
    mediaId: string,
    dto: CompleteUploadDto,
  ): Promise<Record<string, unknown>> {
    const record = await this.repository.findById(mediaId);
    if (!record) {
      throw ApiException.notFound(
        ErrorCodes.MEDIA_NOT_FOUND,
        'Media record not found.',
      );
    }
    if (record.uploadId !== dto.uploadId) {
      throw ApiException.invalid(
        ErrorCodes.MEDIA_UPLOAD_INVALID,
        'Upload id does not match the media record.',
      );
    }
    if (record.status !== 'pending') {
      throw ApiException.conflict(
        ErrorCodes.MEDIA_UPLOAD_INVALID,
        `Media is already in state "${record.status}".`,
      );
    }

    if (record.mimeType.startsWith('image/')) {
      await this.transitionPendingStatus(mediaId, 'processing');

      if (!this.redisConfig.enabled) {
        this.processImageInBackground(mediaId, record.key);
        return { mediaId, status: 'processing' };
      }

      try {
        await this.imageQueue.add(
          'generate-variants',
          { mediaId, key: record.key },
          { jobId: `media-${mediaId}` },
        );
      } catch (error) {
        let restoredPending = false;
        try {
          restoredPending = await this.repository.transitionStatus(
            mediaId,
            'processing',
            'pending',
          );
        } catch (rollbackError) {
          this.logger.error('failed to restore media after queue error', {
            mediaId,
            message: this.errorMessage(rollbackError),
          });
        }

        this.logger.error('failed to enqueue media processing job', {
          mediaId,
          restoredPending,
          message: this.errorMessage(error),
        });
        throw new ApiException(
          ErrorCodes.MEDIA_PROCESSING_FAILED,
          'Unable to start media processing. Please try again.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      return { mediaId, status: 'processing' };
    }

    await this.transitionPendingStatus(mediaId, 'ready');
    return { mediaId, status: 'ready' };
  }

  async list(query: ListMediaQueryDto): Promise<AdminPagedData<MediaDocument>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = { deletedAt: null };
    if (query.status) filter.status = query.status;
    if (query.mimeType) filter.mimeType = query.mimeType;

    const [items, total] = await Promise.all([
      this.repository.find(
        filter,
        { createdAt: -1 },
        limit,
        (page - 1) * limit,
      ),
      this.repository.count(filter),
    ]);
    return adminPageData(items, {
      limit,
      page,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async update(
    mediaId: string,
    dto: UpdateMediaDto,
    admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    const record = await this.repository.findById(mediaId);
    if (!record) {
      throw ApiException.notFound(
        ErrorCodes.MEDIA_NOT_FOUND,
        'Media record not found.',
      );
    }
    const updated = await this.repository.update(mediaId, dto);
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.MEDIA_UPDATED,
      resourceType: 'media',
      resourceId: mediaId,
      after: dto,
    });
    return { mediaId, ...updated };
  }

  async remove(mediaId: string, admin: AdminPrincipal): Promise<void> {
    const record = await this.repository.findById(mediaId);
    if (!record) {
      throw ApiException.notFound(
        ErrorCodes.MEDIA_NOT_FOUND,
        'Media record not found.',
      );
    }
    const keys = [record.key, ...Object.values(record.variants ?? {})];
    await this.storage.deleteObjects(keys);
    await this.repository.softDelete(mediaId);
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.MEDIA_DELETED,
      resourceType: 'media',
      resourceId: mediaId,
      before: { key: record.key },
    });
  }

  /**
   * Resolves object keys to public URLs (including variant URLs). Used by
   * product responses; one batched lookup instead of per-image queries.
   */
  async resolveUrls(keys: string[]): Promise<MediaUrlMap> {
    const uniqueKeys = [...new Set(keys.filter(Boolean))];
    if (uniqueKeys.length === 0) return {};
    const records = await this.repository.findByKeys(uniqueKeys);
    const result: MediaUrlMap = {};
    for (const record of records) {
      const url = this.urlFor(record.key);
      const variants: Record<string, string> = {};
      for (const [name, key] of Object.entries(record.variants ?? {})) {
        variants[name] = this.urlFor(key);
      }
      result[record.key] = { url, variants };
    }
    return result;
  }

  private urlFor(key: string): string {
    return this.r2Config.publicBaseUrl
      ? `${this.r2Config.publicBaseUrl}/${key}`
      : `/${key}`;
  }

  private async transitionPendingStatus(
    mediaId: string,
    status: 'processing' | 'ready',
  ): Promise<void> {
    const transitioned = await this.repository.transitionStatus(
      mediaId,
      'pending',
      status,
    );
    if (!transitioned) {
      throw ApiException.conflict(
        ErrorCodes.MEDIA_UPLOAD_INVALID,
        'Media upload is no longer pending.',
      );
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private processImageInBackground(mediaId: string, key: string): void {
    void this.imageProcessing.process(mediaId, key).catch((error: unknown) => {
      this.logger.error('in-process image processing failed', {
        mediaId,
        message: this.errorMessage(error),
      });
    });
  }

  private validateUploadRequest(dto: PresignMediaDto): void {
    const uploadPolicy = this.uploadPolicy(dto.mimeType);
    if (!uploadPolicy) {
      throw ApiException.invalid(
        ErrorCodes.MEDIA_TYPE_NOT_ALLOWED,
        `MIME type "${dto.mimeType}" is not allowed.`,
        [
          {
            field: 'mimeType',
            message: `Allowed types: ${this.mediaConfig.allowedImageTypes.join(', ')}.`,
          },
        ],
      );
    }
    if (dto.sizeBytes > uploadPolicy.maxSizeBytes) {
      throw ApiException.invalid(
        ErrorCodes.MEDIA_TOO_LARGE,
        `Upload exceeds the ${uploadPolicy.maxSizeBytes}-byte limit.`,
        [{ field: 'sizeBytes', message: 'File is too large.' }],
      );
    }
    const extension = this.extensionOf(dto.fileName);
    if (!uploadPolicy.extensions.includes(extension)) {
      throw ApiException.invalid(
        ErrorCodes.MEDIA_TYPE_NOT_ALLOWED,
        `File extension ".${extension}" is not allowed.`,
        [
          {
            field: 'fileName',
            message: `Allowed extensions: ${uploadPolicy.extensions.join(', ')}.`,
          },
        ],
      );
    }
  }

  private uploadPolicy(
    mimeType: string,
  ): { extensions: string[]; maxSizeBytes: number } | null {
    if (this.mediaConfig.allowedImageTypes.includes(mimeType))
      return {
        extensions: this.mediaConfig.allowedImageExtensions,
        maxSizeBytes: this.mediaConfig.maxUploadSizeBytes,
      };
    if (this.mediaConfig.allowedVideoTypes.includes(mimeType))
      return {
        extensions: this.mediaConfig.allowedVideoExtensions,
        maxSizeBytes: this.mediaConfig.maxVideoUploadSizeBytes,
      };
    if (this.mediaConfig.allowedDocumentTypes.includes(mimeType))
      return {
        extensions: this.mediaConfig.allowedDocumentExtensions,
        maxSizeBytes: this.mediaConfig.maxDocumentUploadSizeBytes,
      };
    return null;
  }

  private extensionOf(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
    return extension.replace(/[^a-z0-9]/g, '');
  }
}
