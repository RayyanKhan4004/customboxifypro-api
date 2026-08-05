import { Injectable } from '@nestjs/common';

import { CacheService } from './cache.service';

/**
 * Namespace-versioned cache invalidation. Public read keys embed a namespace
 * version (e.g. `v1:products:list:{version}:{hash}`). A write calls
 * `bumpNamespace`, which INCRs the version so all keys under that namespace
 * are effectively stale without `KEYS` scans.
 */
@Injectable()
export class CacheInvalidationService {
  constructor(private readonly cache: CacheService) {}

  invalidateProducts(): Promise<number> {
    return this.cache.bumpNamespace('products');
  }

  invalidateCategories(): Promise<number> {
    return this.cache.bumpNamespace('categories');
  }

  invalidateFilters(): Promise<number> {
    return this.cache.bumpNamespace('filters');
  }

  invalidateRbac(): Promise<number> {
    return this.cache.bumpNamespace('rbac');
  }

  async rbacVersion(): Promise<number> {
    return this.cache.namespaceVersion('rbac');
  }

  async productsVersion(): Promise<number> {
    return this.cache.namespaceVersion('products');
  }

  async categoriesVersion(): Promise<number> {
    return this.cache.namespaceVersion('categories');
  }

  async filtersVersion(): Promise<number> {
    return this.cache.namespaceVersion('filters');
  }
}
