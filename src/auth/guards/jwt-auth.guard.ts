import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { CacheInvalidationService } from '../../cache/cache-invalidation.service';
import { CacheService } from '../../cache/cache.service';
import { ErrorCodes } from '../../common/constants/error-codes';
import { ApiException } from '../../common/exceptions/api.exception';
import { AdminPrincipal } from '../../common/interfaces/admin-principal.interface';
import { RequestContextService } from '../../common/logger/request-context.service';
import { AuthConfig } from '../../config/auth.config';
import { RedisConfig } from '../../config/redis.config';
import { AdminRepository } from '../../admins/repositories/admin.repository';
import { RoleRepository } from '../../roles/repositories/role.repository';
import { IS_PUBLIC_KEY } from '../../common/decorators/decorators';
import { TokenService } from '../token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly cache: CacheService,
    private readonly cacheInvalidator: CacheInvalidationService,
    private readonly admins: AdminRepository,
    private readonly roles: RoleRepository,
    private readonly authConfig: AuthConfig,
    private readonly redisConfig: RedisConfig,
    private readonly context: RequestContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { admin?: AdminPrincipal }>();
    const token = this.extractToken(request);
    if (!token) {
      throw ApiException.unauthorized();
    }

    const payload = this.tokens.verifyAccessToken(token);

    if (this.redisConfig.enabled) {
      const sessionAlive = await this.cache.sessionMarkerExists(payload.sid);
      if (!sessionAlive) {
        throw new ApiException(
          ErrorCodes.AUTH_SESSION_REVOKED,
          'The session has been revoked.',
          401,
        );
      }
    }

    const admin = await this.admins.findByIdLean(payload.sub);
    if (!admin || admin.status !== 'active') {
      throw ApiException.unauthorized('The account is not active.');
    }

    const permissions = await this.getPermissions(String(admin.roleId));

    request.admin = {
      id: String(admin._id),
      email: admin.email,
      name: admin.name,
      roleId: String(admin.roleId),
      roleKey: '',
      permissions,
      sessionId: payload.sid,
    };

    this.context.updateCurrent({ adminId: String(admin._id) });
    return true;
  }

  private async getPermissions(roleId: string): Promise<string[]> {
    const version = await this.cacheInvalidator.rbacVersion();
    const cacheKey = `rbac:role:${roleId}:${version}`;
    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached) return cached;

    const role = await this.roles.findActiveById(roleId);
    const permissions = role?.permissions ?? [];
    await this.cache.set(cacheKey, permissions, 60_000);
    return permissions;
  }

  private extractToken(request: Request): string | null {
    const cookies = request.cookies as Record<string, string> | undefined;
    const fromCookie = cookies?.[this.authConfig.cookies.accessName];
    if (fromCookie) return fromCookie;

    const header = request.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return null;
  }

  private isPublic(context: ExecutionContext): boolean {
    return Boolean(
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]),
    );
  }
}
