import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AuthConfig } from '../config/auth.config';
import { ErrorCodes } from '../common/constants/error-codes';
import { ApiException } from '../common/exceptions/api.exception';
import { sha256, generateToken } from '../common/utils/strings';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import type { StringValue } from 'ms';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  sid: string;
  role: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AuthConfig,
  ) {}

  signAccessToken(
    admin: Pick<AdminPrincipal, 'id' | 'email' | 'roleKey'>,
    sessionId: string,
  ): string {
    return this.jwt.sign(
      {
        sub: admin.id,
        email: admin.email,
        sid: sessionId,
        role: admin.roleKey,
      } satisfies AccessTokenPayload,
      {
        secret: this.config.accessSecret,
        expiresIn: this.config.accessExpiresIn as StringValue,
        issuer: this.config.issuer,
        audience: this.config.audience,
      },
    );
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return this.jwt.verify<AccessTokenPayload>(token, {
        secret: this.config.accessSecret,
        issuer: this.config.issuer,
        audience: this.config.audience,
      });
    } catch (error) {
      const expired =
        error instanceof Error && error.name === 'TokenExpiredError';
      throw new ApiException(
        expired ? ErrorCodes.AUTH_TOKEN_EXPIRED : ErrorCodes.AUTH_INVALID_TOKEN,
        expired
          ? 'The access token has expired.'
          : 'The access token is invalid.',
        401,
      );
    }
  }

  generateRefreshToken(): { token: string; hash: string } {
    const token = generateToken(48);
    return { token, hash: sha256(token) };
  }

  hashRefreshToken(token: string): string {
    return sha256(token);
  }
}
