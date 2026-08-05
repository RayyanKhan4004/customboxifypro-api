export interface SearchFilter {
  text: string;
}

/**
 * Search abstraction so product search can evolve from MongoDB text search
 * (initial) to Atlas Search, OpenSearch, or Elasticsearch without touching the
 * product service. Each adapter turns a search filter into a query fragment.
 */
export interface SearchAdapter {
  buildQuery(filter: SearchFilter): Record<string, unknown> | null;
}
