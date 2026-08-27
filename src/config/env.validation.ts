import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
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

const toNumber = ({ value }: { value: unknown }): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const toBoolean = ({ value }: { value: unknown }): boolean | undefined => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
};

export class EnvSchema {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV!: 'development' | 'test' | 'production';

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @Transform(toNumber)
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

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  MONGODB_POOL_SIZE!: number;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  MONGODB_QUERY_TIMEOUT_MS!: number;

  @Transform(toBoolean)
  @IsBoolean()
  REDIS_ENABLED!: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^redis:\/\//, { message: 'REDIS_URL must start with redis://' })
  REDIS_URL?: string;

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

  @Transform(toBoolean)
  @IsBoolean()
  COOKIE_SECURE!: boolean;

  @IsIn(['lax', 'strict', 'none'])
  COOKIE_SAME_SITE!: string;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  AUTH_LOGIN_MAX_ATTEMPTS!: number;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  AUTH_LOCKOUT_MS!: number;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  AUTH_RATE_LIMIT_TTL_MS!: number;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  AUTH_RATE_LIMIT_MAX!: number;

  @Transform(toNumber)
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

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(60)
  R2_UPLOAD_EXPIRES_IN?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1000)
  R2_CONNECTION_TIMEOUT_MS?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1000)
  R2_REQUEST_TIMEOUT_MS?: number;

  @IsOptional()
  @IsString()
  R2_PUBLIC_BASE_URL?: string;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  MEDIA_MAX_UPLOAD_SIZE_BYTES!: number;

  @IsString()
  @IsNotEmpty()
  MEDIA_ALLOWED_IMAGE_TYPES!: string;

  @IsString()
  @IsNotEmpty()
  MEDIA_ALLOWED_IMAGE_EXTENSIONS!: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  BULK_IMPORT_MAX_FILE_SIZE_BYTES?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  BULK_IMPORT_MAX_ROWS?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  BULK_IMPORT_BATCH_SIZE?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  BULK_IMPORT_CONCURRENCY?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  BULK_IMPORT_ZIP_MAX_SIZE_BYTES?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  BULK_IMPORT_ZIP_MAX_FILES?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  BULK_IMPORT_ZIP_MAX_RATIO?: number;

  @Transform(toNumber)
  @IsInt()
  @Min(0)
  CACHE_DEFAULT_TTL_MS!: number;

  @Transform(toNumber)
  @IsInt()
  @Min(0)
  PRODUCT_LIST_CACHE_TTL_MS!: number;

  @Transform(toNumber)
  @IsInt()
  @Min(0)
  PRODUCT_DETAIL_CACHE_TTL_MS!: number;

  @Transform(toNumber)
  @IsInt()
  @Min(0)
  CATEGORY_CACHE_TTL_MS!: number;

  @Transform(toNumber)
  @IsInt()
  @Min(0)
  FILTER_CACHE_TTL_MS!: number;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  RATE_LIMIT_TTL_MS!: number;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  RATE_LIMIT_MAX!: number;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  JOBS_IMAGE_CONCURRENCY!: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  JOBS_CLEANUP_CONCURRENCY?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  JOBS_NOTIFICATION_CONCURRENCY?: number;

  @IsOptional()
  @IsString()
  IMAGE_VARIANT_SIZES?: string;

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

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  SWAGGER_ENABLED?: boolean;

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
  @Transform(toNumber)
  @IsInt()
  SMTP_PORT?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  SMTP_SECURE?: boolean;

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
    enableImplicitConversion: false,
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

  if (
    validated.R2_ACCOUNT_ID &&
    validated.R2_ACCESS_KEY_ID === validated.R2_ACCOUNT_ID
  ) {
    throw new Error(
      'Invalid environment configuration:\nR2_ACCESS_KEY_ID must be the Access Key ID from an R2 S3 API token, not R2_ACCOUNT_ID.',
    );
  }

  return validated as unknown as Record<string, unknown>;
}
