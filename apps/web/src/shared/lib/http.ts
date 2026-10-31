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

/** Uploads a binary body (recorded chunks). */
export async function upload(path: string, blob: Blob, signal?: AbortSignal): Promise<void> {
  const response = await fetch(`/api${path}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': blob.type },
    body: blob,
    signal: withTimeout(60_000, signal),
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

function withTimeout(timeoutMs: number, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([timeout, signal]) : timeout
}
