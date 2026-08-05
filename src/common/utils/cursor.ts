import { ErrorCodes } from '../constants/error-codes';
import { ApiException } from '../exceptions/api.exception';

/** Encodes pagination cursor as base64url JSON. */
export function encodeCursor(parts: unknown[]): string {
  return Buffer.from(JSON.stringify(parts)).toString('base64url');
}

/**
 * Decodes and validates a pagination cursor. Returns null for an empty cursor
 * (first page); throws INVALID_CURSOR for malformed input.
 */
export function decodeCursor(cursor: string | undefined): unknown[] | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as unknown[];
  } catch {
    throw ApiException.invalid(
      ErrorCodes.INVALID_CURSOR,
      'Invalid pagination cursor.',
    );
  }
}

/** Decodes cursor or throws a domain error naming the parameter. */
export function decodeCursorOrThrow(
  cursor: string | undefined,
): unknown[] | null {
  if (cursor === undefined || cursor === '') return null;
  const decoded = decodeCursor(cursor);
  if (decoded === null) {
    throw ApiException.invalid(
      ErrorCodes.INVALID_CURSOR,
      'Invalid pagination cursor.',
    );
  }
  return decoded;
}
