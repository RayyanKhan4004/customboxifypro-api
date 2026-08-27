import { HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';

import { AuditService } from '../audit-logs/audit.service';
import { ErrorCodes } from '../common/constants/error-codes';
import { ApiException } from '../common/exceptions/api.exception';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { AppLogger } from '../common/logger/logger.service';
import { MediaConfig } from '../config/media.config';
import { R2Config } from '../config/r2.config';
import { RedisConfig } from '../config/redis.config';
import { ImageProcessingService } from './image-processing.service';
import { MediaRepository } from './repositories/media.repository';
import { MediaDocument } from './schemas/media.schema';
import { MediaService } from './media.service';
import { S3ObjectStorageService } from './storage/s3-object-storage.service';

const admin: AdminPrincipal = {
  id: new Types.ObjectId().toString(),
  email: 'admin@example.com',
  name: 'Admin',
  roleId: new Types.ObjectId().toString(),
  roleKey: 'super-admin',
  permissions: [],
  sessionId: 'session-id',
};

function mediaRecord(overrides: Partial<MediaDocument> = {}): MediaDocument {
  return {
    _id: new Types.ObjectId(),
    uploadId: 'upload-id',
    key: 'media/2026-08/image.png',
    originalName: 'image.png',
    mimeType: 'image/png',
    sizeBytes: 1024,
    status: 'pending',
    variants: {},
    ...overrides,
  } as MediaDocument;
}

describe('MediaService', () => {
  let service: MediaService;
  let repository: {
    create: jest.Mock;
    findById: jest.Mock;
    transitionStatus: jest.Mock;
  };
  let storage: { createPresignedUpload: jest.Mock };
  let redisConfig: { enabled: boolean; url?: string };
  let imageProcessing: { process: jest.Mock };
  let imageQueue: { add: jest.Mock };
  let logger: { info: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      transitionStatus: jest.fn(),
    };
    storage = { createPresignedUpload: jest.fn() };
    redisConfig = { enabled: true, url: 'redis://localhost:6379' };
    imageProcessing = { process: jest.fn() };
    imageQueue = { add: jest.fn() };
    logger = { info: jest.fn(), error: jest.fn() };

    service = new MediaService(
      repository as unknown as MediaRepository,
      storage as unknown as S3ObjectStorageService,
      {
        maxUploadSizeBytes: 10 * 1024 * 1024,
        allowedImageTypes: ['image/png'],
        allowedImageExtensions: ['png'],
        maxVideoUploadSizeBytes: 100 * 1024 * 1024,
        maxDocumentUploadSizeBytes: 25 * 1024 * 1024,
        allowedVideoTypes: ['video/mp4'],
        allowedVideoExtensions: ['mp4'],
        allowedDocumentTypes: ['application/pdf'],
        allowedDocumentExtensions: ['pdf'],
      } as MediaConfig,
      { uploadExpiresIn: 3600 } as R2Config,
      { log: jest.fn() } as unknown as AuditService,
      logger as unknown as AppLogger,
      redisConfig as unknown as RedisConfig,
      imageProcessing as unknown as ImageProcessingService,
      imageQueue as never,
    );
  });

  it('presigns an upload without touching BullMQ', async () => {
    const record = mediaRecord();
    repository.create.mockResolvedValue(record);
    storage.createPresignedUpload.mockResolvedValue({
      url: 'https://uploads.example.test/image.png',
      method: 'PUT',
    });

    await expect(
      service.presignUpload(
        {
          fileName: 'image.png',
          mimeType: 'image/png',
          sizeBytes: 1024,
        },
        admin,
      ),
    ).resolves.toMatchObject({
      mediaId: record._id.toString(),
      url: 'https://uploads.example.test/image.png',
      method: 'PUT',
    });
    expect(imageQueue.add).not.toHaveBeenCalled();
  });

  it('atomically marks an image as processing before enqueueing it', async () => {
    const record = mediaRecord();
    repository.findById.mockResolvedValue(record);
    repository.transitionStatus.mockResolvedValue(true);
    imageQueue.add.mockResolvedValue(undefined);

    await expect(
      service.completeUpload(record._id.toString(), {
        uploadId: record.uploadId,
      }),
    ).resolves.toEqual({
      mediaId: record._id.toString(),
      status: 'processing',
    });
    expect(repository.transitionStatus).toHaveBeenCalledWith(
      record._id.toString(),
      'pending',
      'processing',
    );
    expect(imageQueue.add).toHaveBeenCalledWith(
      'generate-variants',
      {
        mediaId: record._id.toString(),
        key: record.key,
      },
      {
        jobId: `media-${record._id.toString()}`,
      },
    );
  });

  it('processes images in-process when Redis is disabled', async () => {
    const record = mediaRecord();
    redisConfig.enabled = false;
    repository.findById.mockResolvedValue(record);
    repository.transitionStatus.mockResolvedValue(true);
    imageProcessing.process.mockResolvedValue(undefined);

    await expect(
      service.completeUpload(record._id.toString(), {
        uploadId: record.uploadId,
      }),
    ).resolves.toEqual({
      mediaId: record._id.toString(),
      status: 'processing',
    });
    expect(imageProcessing.process).toHaveBeenCalledWith(
      record._id.toString(),
      record.key,
    );
    expect(imageQueue.add).not.toHaveBeenCalled();
  });

  it('restores pending and returns 503 when enqueueing fails', async () => {
    const record = mediaRecord();
    repository.findById.mockResolvedValue(record);
    repository.transitionStatus
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    imageQueue.add.mockRejectedValue(new Error('Redis unavailable'));

    const error = await service
      .completeUpload(record._id.toString(), { uploadId: record.uploadId })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe(
      ErrorCodes.MEDIA_PROCESSING_FAILED,
    );
    expect((error as ApiException).getStatus()).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect(repository.transitionStatus).toHaveBeenNthCalledWith(
      2,
      record._id.toString(),
      'processing',
      'pending',
    );
    expect(logger.error).toHaveBeenCalledWith(
      'failed to enqueue media processing job',
      expect.objectContaining({
        mediaId: record._id.toString(),
        restoredPending: true,
      }),
    );
  });

  it('does not overwrite a state changed by a possibly accepted job', async () => {
    const record = mediaRecord();
    repository.findById.mockResolvedValue(record);
    repository.transitionStatus
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    imageQueue.add.mockRejectedValue(new Error('Connection closed'));

    await expect(
      service.completeUpload(record._id.toString(), {
        uploadId: record.uploadId,
      }),
    ).rejects.toMatchObject({ code: ErrorCodes.MEDIA_PROCESSING_FAILED });
    expect(repository.transitionStatus).toHaveBeenNthCalledWith(
      2,
      record._id.toString(),
      'processing',
      'pending',
    );
    expect(logger.error).toHaveBeenLastCalledWith(
      'failed to enqueue media processing job',
      expect.objectContaining({ restoredPending: false }),
    );
  });

  it('does not enqueue when another request already claimed the upload', async () => {
    const record = mediaRecord();
    repository.findById.mockResolvedValue(record);
    repository.transitionStatus.mockResolvedValue(false);

    const error = await service
      .completeUpload(record._id.toString(), { uploadId: record.uploadId })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getStatus()).toBe(HttpStatus.CONFLICT);
    expect(imageQueue.add).not.toHaveBeenCalled();
  });

  it('marks non-image uploads ready without enqueueing a job', async () => {
    const record = mediaRecord({
      key: 'media/2026-08/document.pdf',
      mimeType: 'application/pdf',
      originalName: 'document.pdf',
    });
    repository.findById.mockResolvedValue(record);
    repository.transitionStatus.mockResolvedValue(true);

    await expect(
      service.completeUpload(record._id.toString(), {
        uploadId: record.uploadId,
      }),
    ).resolves.toEqual({
      mediaId: record._id.toString(),
      status: 'ready',
    });
    expect(repository.transitionStatus).toHaveBeenCalledWith(
      record._id.toString(),
      'pending',
      'ready',
    );
    expect(imageQueue.add).not.toHaveBeenCalled();
  });

  it('enqueues at most once across concurrent completion requests', async () => {
    const record = mediaRecord();
    repository.findById.mockResolvedValue(record);
    repository.transitionStatus
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    imageQueue.add.mockResolvedValue(undefined);

    const results = await Promise.allSettled([
      service.completeUpload(record._id.toString(), {
        uploadId: record.uploadId,
      }),
      service.completeUpload(record._id.toString(), {
        uploadId: record.uploadId,
      }),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(imageQueue.add).toHaveBeenCalledTimes(1);
  });
});
