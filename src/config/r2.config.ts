import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class R2Config {
  readonly accountId?: string;
  readonly accessKeyId?: string;
  readonly secretAccessKey?: string;
  readonly bucketName: string;
  readonly publicBucketName?: string;
  readonly endpoint?: string;
  readonly region: string;
  readonly uploadExpiresIn: number;
  readonly connectionTimeoutMs: number;
  readonly requestTimeoutMs: number;
  readonly publicBaseUrl?: string;

  constructor(private readonly config: ConfigService) {
    this.accountId = config.get('R2_ACCOUNT_ID') || undefined;
    this.accessKeyId = config.get('R2_ACCESS_KEY_ID') || undefined;
    this.secretAccessKey = config.get('R2_SECRET_ACCESS_KEY') || undefined;
    this.bucketName = config.get<string>('R2_BUCKET_NAME') || 'boxify-media';
    this.publicBucketName = config.get('R2_PUBLIC_BUCKET_NAME') || undefined;
    this.endpoint = config.get('R2_ENDPOINT') || undefined;
    this.region = config.get<string>('R2_REGION') || 'auto';
    this.uploadExpiresIn = Number(config.get('R2_UPLOAD_EXPIRES_IN') ?? 3600);
    this.connectionTimeoutMs = Number(
      config.get('R2_CONNECTION_TIMEOUT_MS') ?? 5000,
    );
    this.requestTimeoutMs = Number(
      config.get('R2_REQUEST_TIMEOUT_MS') ?? 10000,
    );
    this.validateCredentials();
    this.publicBaseUrl = this.normalizeBaseUrl(
      config.get('R2_PUBLIC_BASE_URL'),
    );
  }

  private validateCredentials(): void {
    if (this.accountId && this.accessKeyId === this.accountId) {
      throw new Error(
        'R2_ACCESS_KEY_ID must be the Access Key ID from an R2 S3 API token, not R2_ACCOUNT_ID.',
      );
    }

    if (this.secretAccessKey?.startsWith('http')) {
      throw new Error(
        'R2_SECRET_ACCESS_KEY must be the secret from an R2 S3 API token, not an endpoint URL.',
      );
    }
  }

  private normalizeBaseUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    return url.replace(/\/+$/, '');
  }
}
