import { Global, Module } from '@nestjs/common';

import { CacheInvalidationService } from './cache-invalidation.service';
import { CacheService } from './cache.service';

@Global()
@Module({
  providers: [CacheService, CacheInvalidationService],
  exports: [CacheService, CacheInvalidationService],
})
export class CacheModule {}
