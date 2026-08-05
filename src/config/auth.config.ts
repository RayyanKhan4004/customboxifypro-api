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
    this.accessSecret = config.get<string>('JWT_ACCESS_SECRET')!;
    this.refreshSecret = config.get<string>('JWT_REFRESH_SECRET')!;
    this.accessExpiresIn = config.get<string>('JWT_ACCESS_EXPIRES_IN')!;
    this.refreshExpiresIn = config.get<string>('JWT_REFRESH_EXPIRES_IN')!;
    this.refreshExpiresMs = parseMs(this.refreshExpiresIn);
    this.issuer = config.get<string>('JWT_ISSUER')!;
    this.audience = config.get<string>('JWT_AUDIENCE')!;
    this.cookies = {
      accessName: config.get<string>('COOKIE_ACCESS_NAME')!,
      refreshName: config.get<string>('COOKIE_REFRESH_NAME')!,
      domain: config.get<string>('COOKIE_DOMAIN') || undefined,
      secure: config.get<string>('COOKIE_SECURE') === 'true',
      sameSite: config.get<string>(
        'COOKIE_SAME_SITE',
      ) as CookieSettings['sameSite'],
    };
    this.loginMaxAttempts = Number(config.get('AUTH_LOGIN_MAX_ATTEMPTS'));
    this.lockoutMs = Number(config.get('AUTH_LOCKOUT_MS'));
    this.rateLimitTtlMs = Number(config.get('AUTH_RATE_LIMIT_TTL_MS'));
    this.rateLimitMax = Number(config.get('AUTH_RATE_LIMIT_MAX'));
    this.passwordMinLength = Number(config.get('AUTH_PASSWORD_MIN_LENGTH'));
  }
}

function parseMs(duration: string): number {
  const match = /^(\d+)(s|m|h|d|w)$/.exec(duration);
  if (!match) return 0;
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
