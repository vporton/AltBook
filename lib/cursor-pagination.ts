export const DEFAULT_CURSOR_LIMIT = 20;
export const MAX_CURSOR_LIMIT = 100;

export class CursorPaginationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CursorPaginationError";
  }
}

export function parseCursorPagination(searchParams: URLSearchParams) {
  const cursorRaw = searchParams.get("cursor");
  const limitRaw = searchParams.get("limit");
  const cursor = cursorRaw?.trim();

  if (cursorRaw !== null && !cursor) {
    throw new CursorPaginationError("cursor must not be empty.");
  }

  if (limitRaw === null || limitRaw.trim() === "") {
    return {
      cursor: cursor || undefined,
      limit: DEFAULT_CURSOR_LIMIT,
    };
  }

  const limit = Number(limitRaw);

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CURSOR_LIMIT) {
    throw new CursorPaginationError(
      `limit must be an integer between 1 and ${MAX_CURSOR_LIMIT}.`,
    );
  }

  return {
    cursor: cursor || undefined,
    limit,
  };
}
