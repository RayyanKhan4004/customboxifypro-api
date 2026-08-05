import { Injectable } from '@nestjs/common';
import { Response } from 'express';

import { AuthConfig } from '../config/auth.config';

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  domain?: string;
  maxAge?: number;
}

@Injectable()
export class CookieService {
  constructor(private readonly config: AuthConfig) {}

  private baseOptions(maxAgeMs?: number): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.cookies.secure,
      sameSite: this.config.cookies.sameSite,
      path: '/',
      domain: this.config.cookies.domain,
      maxAge: maxAgeMs,
    };
  }

  setAccessCookie(res: Response, token: string): void {
    res.cookie(this.config.cookies.accessName, token, this.baseOptions());
  }

  setRefreshCookie(res: Response, token: string): void {
    res.cookie(
      this.config.cookies.refreshName,
      token,
      this.baseOptions(this.config.refreshExpiresMs),
    );
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie(this.config.cookies.accessName, {
      path: '/',
      domain: this.config.cookies.domain,
    });
    res.clearCookie(this.config.cookies.refreshName, {
      path: '/',
      domain: this.config.cookies.domain,
    });
  }
}
