/**
 * Single source for the API error envelope: `{ error: { code, message } }`.
 * Used by routes, the 404 handler, and the central error handler so the shape
 * is produced in exactly one place. Mirrors architecture.md §6 `ApiError`.
 */
export function apiError(code: string, message: string) {
  return { error: { code, message } } as const;
}
