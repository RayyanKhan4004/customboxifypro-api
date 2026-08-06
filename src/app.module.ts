import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { CacheModule } from './cache/cache.module';
import { CacheService } from './cache/cache.service';
import { RedisThrottlerStorage } from './cache/redis-throttler.storage';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggerModule } from './common/logger/logger.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { SecurityModule } from './common/security/security.module';
import { AppConfig } from './config/app.config';
import { ConfigurationModule } from './config/configuration.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AdminsModule } from './admins/admins.module';
import { RolesModule } from './roles/roles.module';
import { CategoriesModule } from './categories/categories.module';
import { FilterDefinitionsModule } from './filter-definitions/filter-definitions.module';
import { ProductsModule } from './products/products.module';
import { MediaModule } from './media/media.module';
import { BulkImportsModule } from './bulk-imports/bulk-imports.module';
import { CustomerRequestsModule } from './customer-requests/customer-requests.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigurationModule,
    LoggerModule,
    DatabaseModule,
    CacheModule,
    SecurityModule,
    HealthModule,
    ThrottlerModule.forRootAsync({
      inject: [CacheService, AppConfig],
      useFactory: (cache: CacheService, app: AppConfig) => ({
        storage: cache.raw
          ? new RedisThrottlerStorage(cache.raw)
          : undefined,
        throttlers: [
          {
            name: 'global',
            ttl: app.rateLimitTtlMs,
            limit: app.rateLimitMax,
          },
        ],
        errorMessage: 'Too many requests. Please try again later.',
      }),
    }),
    JwtModule.register({ global: true }),
    JobsModule,
    AuthModule,
    AdminsModule,
    RolesModule,
    CategoriesModule,
    FilterDefinitionsModule,
    ProductsModule,
    MediaModule,
    BulkImportsModule,
    CustomerRequestsModule,
    AuditLogsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
