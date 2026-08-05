import { Injectable } from '@nestjs/common';

import { SearchAdapter, SearchFilter } from './search.interface';

/**
 * Initial search implementation: MongoDB text index on name/description/tags.
 * Uses $text which is index-backed. Requires the text index declared in
 * src/database/indexes.ts.
 */
@Injectable()
export class MongoSearchAdapter implements SearchAdapter {
  buildQuery(filter: SearchFilter): Record<string, unknown> | null {
    const text = filter.text.trim();
    if (!text) return null;
    // Sanitize: strip characters that break $text parsing; cap length.
    const sanitized = text
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .trim()
      .slice(0, 200);
    if (!sanitized) return null;
    return { $text: { $search: sanitized } };
  }
}
