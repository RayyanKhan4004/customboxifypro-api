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
    this.nodeEnv = config.get<EnvValue>('NODE_ENV') as AppConfig['nodeEnv'];
    this.port = Number(config.get('PORT'));
    this.apiPrefix = config.get<string>('API_PREFIX')!;
    this.appName = config.get<string>('APP_NAME')!;
    this.logLevel = config.get<string>('LOG_LEVEL')!;
    this.isProduction = this.nodeEnv === 'production';
    this.cors = {
      allowedOrigins: this.splitList(config.get('CORS_ALLOWED_ORIGINS')),
      adminUrl: config.get<string>('ADMIN_APP_URL')!,
      clientUrl: config.get<string>('CLIENT_APP_URL')!,
    };
    this.swaggerEnabled = config.get<string>('SWAGGER_ENABLED') === 'true';
    this.swaggerUsername = config.get('SWAGGER_USERNAME') || undefined;
    this.swaggerPassword = config.get('SWAGGER_PASSWORD') || undefined;
    this.rateLimitTtlMs = Number(config.get('RATE_LIMIT_TTL_MS'));
    this.rateLimitMax = Number(config.get('RATE_LIMIT_MAX'));
    this.pageMaxLimit = Number(config.get('PAGE_MAX_LIMIT'));
  }

  private splitList(value: string | undefined): string[] {
    return (value ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

type EnvValue = string;
