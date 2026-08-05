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
  readonly publicBaseUrl?: string;

  constructor(private readonly config: ConfigService) {
    this.accountId = config.get('R2_ACCOUNT_ID') || undefined;
    this.accessKeyId = config.get('R2_ACCESS_KEY_ID') || undefined;
    this.secretAccessKey = config.get('R2_SECRET_ACCESS_KEY') || undefined;
    this.bucketName = config.get<string>('R2_BUCKET_NAME') || 'boxify-media';
    this.publicBucketName = config.get('R2_PUBLIC_BUCKET_NAME') || undefined;
    this.endpoint = config.get('R2_ENDPOINT') || undefined;
    this.region = config.get<string>('R2_REGION') || 'auto';
    this.uploadExpiresIn = Number(config.get('R2_UPLOAD_EXPIRES_IN'));
    this.publicBaseUrl = this.normalizeBaseUrl(
      config.get('R2_PUBLIC_BASE_URL'),
    );
  }

  private normalizeBaseUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    return url.replace(/\/+$/, '');
  }
}
