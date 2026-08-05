import { Injectable } from '@nestjs/common';

import { MongoSearchAdapter } from './mongo-search.adapter';
import { SearchFilter } from './search.interface';

@Injectable()
export class SearchService {
  constructor(private readonly adapter: MongoSearchAdapter) {}

  buildQuery(filter: SearchFilter): Record<string, unknown> | null {
    return this.adapter.buildQuery(filter);
  }
}
