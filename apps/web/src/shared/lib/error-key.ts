import { ApiError, isNetworkError } from './http'

export type ErrorKey =
  | 'common.error.offline'
  | 'common.error.signedOut'
  | 'common.error.forbidden'
  | 'common.error.notFound'
  | 'common.error.conflict'
  | 'common.error.unavailable'
  | 'common.error.generic'

/**
 * What to tell the user about a failed request, as a message key: the text follows the interface language,
 * and raw server or browser messages ("Failed to fetch") never reach the screen.
 */
export function errorKey(error: unknown): ErrorKey
/** `overrides`: what a status means for this action, e.g. 409 when starting an exam: "not open yet". */
export function errorKey<K extends string>(
  error: unknown,
  overrides: Partial<Record<number, K>>,
): ErrorKey | K
export function errorKey(error: unknown, overrides: Partial<Record<number, string>> = {}): string {
  if (error instanceof ApiError) {
    const own = overrides[error.status]
    if (own) return own
    if (error.status === 401) return 'common.error.signedOut'
    if (error.status === 403) return 'common.error.forbidden'
    if (error.status === 404) return 'common.error.notFound'
    if (error.status === 409) return 'common.error.conflict'
    if (error.status >= 500) return 'common.error.unavailable'
  }
  if (isNetworkError(error)) return 'common.error.offline'
  console.error(error)
  return 'common.error.generic'
}
