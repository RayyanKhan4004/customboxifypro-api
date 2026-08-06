import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CookieSettings {
  accessName: string;
  refreshName: string;
  domain?: string;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
}

@Injectable()
export class AuthConfig {
  readonly accessSecret: string;
  readonly refreshSecret: string;
  readonly accessExpiresIn: string;
  readonly refreshExpiresIn: string;
  readonly refreshExpiresMs: number;
  readonly issuer: string;
  readonly audience: string;
  readonly cookies: CookieSettings;
  readonly loginMaxAttempts: number;
  readonly lockoutMs: number;
  readonly rateLimitTtlMs: number;
  readonly rateLimitMax: number;
  readonly passwordMinLength: number;

  constructor(private readonly config: ConfigService) {
    this.accessSecret = config.get<string>('JWT_ACCESS_SECRET') ?? 'change-me-access-secret-min-32-chars';
    this.refreshSecret = config.get<string>('JWT_REFRESH_SECRET') ?? 'change-me-refresh-secret-min-32-chars';
    this.accessExpiresIn = config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    this.refreshExpiresIn = config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';
    this.refreshExpiresMs = parseMs(this.refreshExpiresIn);
    this.issuer = config.get<string>('JWT_ISSUER') ?? 'custom-boxify-api';
    this.audience = config.get<string>('JWT_AUDIENCE') ?? 'custom-boxify-admin';
    this.cookies = {
      accessName: config.get<string>('COOKIE_ACCESS_NAME') ?? 'boxify_access',
      refreshName: config.get<string>('COOKIE_REFRESH_NAME') ?? 'boxify_refresh',
      domain: config.get<string>('COOKIE_DOMAIN') || undefined,
      secure: config.get('COOKIE_SECURE') === true || config.get<string>('COOKIE_SECURE') === 'true',
      sameSite: (config.get<string>('COOKIE_SAME_SITE') ?? 'lax') as CookieSettings['sameSite'],
    };
    this.loginMaxAttempts = Number(config.get('AUTH_LOGIN_MAX_ATTEMPTS') ?? 5);
    this.lockoutMs = Number(config.get('AUTH_LOCKOUT_MS') ?? 900000);
    this.rateLimitTtlMs = Number(config.get('AUTH_RATE_LIMIT_TTL_MS') ?? 60000);
    this.rateLimitMax = Number(config.get('AUTH_RATE_LIMIT_MAX') ?? 10);
    this.passwordMinLength = Number(config.get('AUTH_PASSWORD_MIN_LENGTH') ?? 12);
  }
}

function parseMs(duration: string): number {
  const match = /^(\d+)(s|m|h|d|w)$/.exec(duration);
  if (!match) return 86_400_000;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  };
  return value * multipliers[unit];
}
