import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CorsOptions {
  allowedOrigins: string[];
  adminUrl: string;
  clientUrl: string;
}

@Injectable()
export class AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly port: number;
  readonly apiPrefix: string;
  readonly appName: string;
  readonly logLevel: string;
  readonly isProduction: boolean;
  readonly cors: CorsOptions;
  readonly swaggerEnabled: boolean;
  readonly swaggerUsername?: string;
  readonly swaggerPassword?: string;
  readonly rateLimitTtlMs: number;
  readonly rateLimitMax: number;
  readonly pageMaxLimit: number;

  constructor(private readonly config: ConfigService) {
    this.nodeEnv = (config.get<string>('NODE_ENV') ?? 'development') as AppConfig['nodeEnv'];
    this.port = Number(config.get('PORT') ?? 3000);
    this.apiPrefix = config.get<string>('API_PREFIX') ?? '/api/v1';
    this.appName = config.get<string>('APP_NAME') ?? 'custom-boxify-api';
    this.logLevel = config.get<string>('LOG_LEVEL') ?? 'info';
    this.isProduction = this.nodeEnv === 'production';
    this.cors = {
      allowedOrigins: this.splitList(config.get('CORS_ALLOWED_ORIGINS')),
      adminUrl: config.get<string>('ADMIN_APP_URL') ?? 'http://localhost:3001',
      clientUrl: config.get<string>('CLIENT_APP_URL') ?? 'http://localhost:3000',
    };
    this.swaggerEnabled = config.get('SWAGGER_ENABLED') === true || config.get<string>('SWAGGER_ENABLED') === 'true';
    this.swaggerUsername = config.get('SWAGGER_USERNAME') || undefined;
    this.swaggerPassword = config.get('SWAGGER_PASSWORD') || undefined;
    this.rateLimitTtlMs = Number(config.get('RATE_LIMIT_TTL_MS') ?? 60000);
    this.rateLimitMax = Number(config.get('RATE_LIMIT_MAX') ?? 120);
    this.pageMaxLimit = Number(config.get('PAGE_MAX_LIMIT') ?? 100);
  }

  private splitList(value: string | undefined): string[] {
    return (value ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}
