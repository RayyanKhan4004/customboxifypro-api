import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { ApiException } from '../../common/exceptions/api.exception';
import { AdminPrincipal } from '../../common/interfaces/admin-principal.interface';
import {
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
} from '../../common/decorators/decorators';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublic(context)) return true;

    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { admin?: AdminPrincipal }>();
    const admin = request.admin;
    if (!admin) {
      throw ApiException.unauthorized();
    }

    const hasAll = required.every((permission) =>
      admin.permissions.includes(permission),
    );
    if (!hasAll) {
      throw ApiException.forbidden();
    }
    return true;
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
