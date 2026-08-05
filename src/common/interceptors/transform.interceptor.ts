import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';

import { SKIP_TRANSFORM_KEY } from '../decorators/decorators';
import { AdminPagedData, PagedData } from '../dto/pagination.types';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skipTransform = this.reflector.getAllAndOverride<boolean>(
      SKIP_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((data: unknown) => {
        if (skipTransform) return data;
        if (data === undefined || data === null) return data;
        if (typeof data !== 'object') return { success: true, data };
        if ('success' in data) return data;

        if (this.isPaged(data)) {
          const paged = data as PagedData<unknown> | AdminPagedData<unknown>;
          return { success: true, data: paged.data, meta: paged.meta };
        }

        return { success: true, data };
      }),
    );
  }

  private isPaged(data: unknown): boolean {
    const value = data as { data?: unknown; meta?: unknown };
    return (
      value !== null &&
      typeof value === 'object' &&
      'data' in value &&
      'meta' in value
    );
  }
}
