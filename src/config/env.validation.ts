import { plainToInstance, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export class EnvSchema {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV!: 'development' | 'test' | 'production';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  PAGE_MAX_LIMIT!: number;

  @IsString()
  @IsNotEmpty()
  API_PREFIX!: string;

  @IsString()
  @IsNotEmpty()
  APP_NAME!: string;

  @IsIn(['debug', 'info', 'warn', 'error'])
  LOG_LEVEL!: string;

  @IsString()
  @IsNotEmpty()
  MONGODB_URI!: string;

  @IsString()
  @IsNotEmpty()
  MONGODB_DATABASE_NAME!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  MONGODB_POOL_SIZE!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  MONGODB_QUERY_TIMEOUT_MS!: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^redis:\/\//, { message: 'REDIS_URL must start with redis://' })
  REDIS_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @Matches(/^[0-9]+[smhdw]$/, {
    message: 'JWT_ACCESS_EXPIRES_IN must look like 15m, 1h, 30d',
  })
  JWT_ACCESS_EXPIRES_IN!: string;

  @IsString()
  @Matches(/^[0-9]+[smhdw]$/, {
    message: 'JWT_REFRESH_EXPIRES_IN must look like 30d',
  })
  JWT_REFRESH_EXPIRES_IN!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ISSUER!: string;

  @IsString()
  @IsNotEmpty()
  JWT_AUDIENCE!: string;

  @IsString()
  @IsNotEmpty()
  ADMIN_APP_URL!: string;

  @IsString()
  @IsNotEmpty()
  CLIENT_APP_URL!: string;

  @IsString()
  @IsNotEmpty()
  CORS_ALLOWED_ORIGINS!: string;

  @IsString()
  @IsNotEmpty()
  COOKIE_ACCESS_NAME!: string;

  @IsString()
  @IsNotEmpty()
  COOKIE_REFRESH_NAME!: string;

  @IsOptional()
  @IsString()
  COOKIE_DOMAIN?: string;

  @IsBooleanString()
  COOKIE_SECURE!: string;

  @IsIn(['lax', 'strict', 'none'])
  COOKIE_SAME_SITE!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_LOGIN_MAX_ATTEMPTS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_LOCKOUT_MS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_RATE_LIMIT_TTL_MS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_RATE_LIMIT_MAX!: number;

  @Type(() => Number)
  @IsInt()
  @Min(8)
  AUTH_PASSWORD_MIN_LENGTH!: number;

  @IsOptional()
  @IsString()
  R2_ACCOUNT_ID?: string;

  @IsOptional()
  @IsString()
  R2_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  R2_SECRET_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  R2_BUCKET_NAME?: string;

  @IsOptional()
  @IsString()
  R2_PUBLIC_BUCKET_NAME?: string;

  @IsOptional()
  @IsString()
  R2_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  R2_REGION?: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  R2_UPLOAD_EXPIRES_IN!: number;

  @IsOptional()
  @IsString()
  R2_PUBLIC_BASE_URL?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  MEDIA_MAX_UPLOAD_SIZE_BYTES!: number;

  @IsString()
  @IsNotEmpty()
  MEDIA_ALLOWED_IMAGE_TYPES!: string;

  @IsString()
  @IsNotEmpty()
  MEDIA_ALLOWED_IMAGE_EXTENSIONS!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  BULK_IMPORT_MAX_FILE_SIZE_BYTES!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  BULK_IMPORT_MAX_ROWS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  BULK_IMPORT_BATCH_SIZE!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  BULK_IMPORT_CONCURRENCY!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  BULK_IMPORT_ZIP_MAX_SIZE_BYTES!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  BULK_IMPORT_ZIP_MAX_FILES!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  BULK_IMPORT_ZIP_MAX_RATIO!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  CACHE_DEFAULT_TTL_MS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  PRODUCT_LIST_CACHE_TTL_MS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  PRODUCT_DETAIL_CACHE_TTL_MS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  CATEGORY_CACHE_TTL_MS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  FILTER_CACHE_TTL_MS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  RATE_LIMIT_TTL_MS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  RATE_LIMIT_MAX!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  JOBS_IMAGE_CONCURRENCY!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  JOBS_CLEANUP_CONCURRENCY!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  JOBS_NOTIFICATION_CONCURRENCY!: number;

  @IsString()
  @IsNotEmpty()
  IMAGE_VARIANT_SIZES!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  SEED_SUPER_ADMIN_EMAIL?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  SEED_SUPER_ADMIN_PASSWORD?: string;

  @IsOptional()
  @IsString()
  SEED_SUPER_ADMIN_NAME?: string;

  @IsBooleanString()
  SWAGGER_ENABLED!: string;

  @IsOptional()
  @IsString()
  SWAGGER_USERNAME?: string;

  @IsOptional()
  @IsString()
  SWAGGER_PASSWORD?: string;

  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  SMTP_PORT?: number;

  @IsOptional()
  @IsBooleanString()
  SMTP_SECURE?: string;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  @IsOptional()
  @IsString()
  EMAIL_FROM?: string;

  @IsOptional()
  @IsString()
  RECAPTCHA_SITE_KEY?: string;

  @IsOptional()
  @IsString()
  RECAPTCHA_SECRET?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const validated = plainToInstance(EnvSchema, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    whitelist: true,
    forbidUnknownValues: true,
  });

  if (errors.length > 0) {
    const messages = errors.map(
      (e) => `${e.property}: ${Object.values(e.constraints ?? {}).join('; ')}`,
    );
    throw new Error(
      `Invalid environment configuration:\n${messages.join('\n')}`,
    );
  }

  return validated as unknown as Record<string, unknown>;
}
