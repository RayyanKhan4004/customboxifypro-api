import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { AppLogger } from '../../common/logger/logger.service';
import { R2Config } from '../../config/r2.config';
import { ObjectStorage } from './object-storage.interface';

@Injectable()
export class S3ObjectStorageService implements ObjectStorage {
  private readonly client: S3Client;

  constructor(
    private readonly config: R2Config,
    private readonly logger: AppLogger,
  ) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint ?? undefined,
      credentials: {
        accessKeyId: config.accessKeyId ?? '',
        secretAccessKey: config.secretAccessKey ?? '',
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async createPresignedUpload(
    key: string,
    contentType: string,
    contentLength: number,
  ): Promise<{ url: string; method: 'PUT' }> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: this.config.uploadExpiresIn,
    });
    return { url, method: 'PUT' };
  }

  async headObject(
    key: string,
  ): Promise<{ size: number; contentType: string } | null> {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucketName, Key: key }),
      );
      return {
        size: head.ContentLength ?? 0,
        contentType: head.ContentType ?? '',
      };
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  async getObject(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucketName, Key: key }),
    );
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucketName, Key: key }),
    );
  }

  async deleteObjects(keys: string[]): Promise<void> {
    for (const key of keys) {
      if (key) {
        try {
          await this.deleteObject(key);
        } catch (error) {
          this.logger.warn('failed to delete object', {
            key,
            message: (error as Error).message,
          });
        }
      }
    }
  }
}
