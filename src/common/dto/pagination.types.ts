export interface PageMeta {
  limit: number;
  total: number;
  page?: number;
  pageSize?: number;
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface CursorPageMeta {
  nextCursor: string | null;
  hasNextPage: boolean;
  limit: number;
  total?: number;
}

export interface PagedData<T> {
  data: T[];
  meta: CursorPageMeta;
}

export interface AdminPageMeta {
  limit: number;
  page: number;
  total: number;
  totalPages: number;
}

export interface AdminPagedData<T> {
  data: T[];
  meta: AdminPageMeta;
}

export interface AppResponse<T = unknown> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export function pageData<T>(data: T[], meta: CursorPageMeta): PagedData<T> {
  return { data, meta };
}

export function adminPageData<T>(
  data: T[],
  meta: AdminPageMeta,
): AdminPagedData<T> {
  return { data, meta };
}
