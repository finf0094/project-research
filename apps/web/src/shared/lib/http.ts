import type { z } from 'zod'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  timeoutMs?: number
  signal?: AbortSignal
}

/**
 * JSON request to the API. A response schema is optional: pass one where the client relies on the shape.
 * Network failures and timeouts throw a TypeError/DOMException; HTTP errors throw ApiError.
 */
export async function request<T = unknown>(
  path: string,
  options: RequestOptions = {},
  schema?: z.ZodType<T>,
): Promise<T> {
  const { method = 'GET', body, timeoutMs = 15_000, signal } = options
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: withTimeout(timeoutMs, signal),
  })
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response))
  if (response.status === 204) return undefined as T
  const data: unknown = await response.json()
  return schema ? schema.parse(data) : (data as T)
}

/** The slowest uplink an upload is given time for (a weak mobile connection), in bytes per second. */
const SLOWEST_UPLINK_BPS = 25_000

/** Uploads a binary body (recorded chunks); a large one gets more time than a minute on a slow uplink. */
export async function upload(path: string, blob: Blob, signal?: AbortSignal): Promise<void> {
  const response = await fetch(`/api${path}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': blob.type },
    body: blob,
    signal: withTimeout(Math.max(60_000, (blob.size / SLOWEST_UPLINK_BPS) * 1000), signal),
  })
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response))
}

async function errorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: string }
    return body.message ?? response.statusText
  } catch {
    return response.statusText
  }
}

/** True for failures caused by the connection (offline, timeout, server down), not by the request itself. */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status >= 500 || error.status === 408
  return error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError')
}

/**
 * The caller's signal plus a timeout. `AbortSignal.any` came in Safari 17.4 and `AbortSignal.timeout` in 16:
 * where missing they are built by hand, or every request would throw and the exam would look offline for good.
 */
export function withTimeout(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  if (typeof AbortSignal.timeout === 'function' && (!signal || typeof AbortSignal.any === 'function')) {
    const timeout = AbortSignal.timeout(timeoutMs)
    return signal ? AbortSignal.any([timeout, signal]) : timeout
  }
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(new DOMException('The operation timed out.', 'TimeoutError')),
    timeoutMs,
  )
  const follow = () => (clearTimeout(timer), controller.abort(signal?.reason))
  if (signal?.aborted) follow()
  else signal?.addEventListener('abort', follow, { once: true })
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  return controller.signal
}
