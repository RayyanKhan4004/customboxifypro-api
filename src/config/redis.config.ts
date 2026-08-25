import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisConfig {
  readonly enabled: boolean;
  readonly url?: string;
  readonly defaultTtlMs: number;
  readonly productListCacheTtlMs: number;
  readonly productDetailCacheTtlMs: number;
  readonly categoryCacheTtlMs: number;
  readonly filterCacheTtlMs: number;

  constructor(private readonly config: ConfigService) {
    this.enabled =
      config.get('REDIS_ENABLED') === true ||
      config.get<string>('REDIS_ENABLED') === 'true';
    this.url = config.get<string>('REDIS_URL') || undefined;
    this.defaultTtlMs = Number(config.get('CACHE_DEFAULT_TTL_MS') ?? 300000);
    this.productListCacheTtlMs = Number(
      config.get('PRODUCT_LIST_CACHE_TTL_MS') ?? 300000,
    );
    this.productDetailCacheTtlMs = Number(
      config.get('PRODUCT_DETAIL_CACHE_TTL_MS') ?? 600000,
    );
    this.categoryCacheTtlMs = Number(
      config.get('CATEGORY_CACHE_TTL_MS') ?? 600000,
    );
    this.filterCacheTtlMs = Number(config.get('FILTER_CACHE_TTL_MS') ?? 600000);
  }
}
