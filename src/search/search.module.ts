import { Module } from '@nestjs/common';

import { MongoSearchAdapter } from './mongo-search.adapter';
import { SearchService } from './search.service';

@Module({
  providers: [SearchService, MongoSearchAdapter],
  exports: [SearchService],
})
export class SearchModule {}
