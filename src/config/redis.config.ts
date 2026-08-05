import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisConfig {
  readonly url: string;
  readonly defaultTtlMs: number;
  readonly productListCacheTtlMs: number;
  readonly productDetailCacheTtlMs: number;
  readonly categoryCacheTtlMs: number;
  readonly filterCacheTtlMs: number;

  constructor(private readonly config: ConfigService) {
    this.url = config.get<string>('REDIS_URL')!;
    this.defaultTtlMs = Number(config.get('CACHE_DEFAULT_TTL_MS'));
    this.productListCacheTtlMs = Number(
      config.get('PRODUCT_LIST_CACHE_TTL_MS'),
    );
    this.productDetailCacheTtlMs = Number(
      config.get('PRODUCT_DETAIL_CACHE_TTL_MS'),
    );
    this.categoryCacheTtlMs = Number(config.get('CATEGORY_CACHE_TTL_MS'));
    this.filterCacheTtlMs = Number(config.get('FILTER_CACHE_TTL_MS'));
  }
}
