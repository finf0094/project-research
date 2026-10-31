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
  const { method = 'GET', body, timeoutMs = 15_000 } = options
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response))
  if (response.status === 204) return undefined as T
  const data: unknown = await response.json()
  return schema ? schema.parse(data) : (data as T)
}

/** Uploads a binary body (recorded chunks). */
export async function upload(path: string, blob: Blob, timeoutMs = 60_000): Promise<void> {
  const response = await fetch(`/api${path}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': blob.type },
    body: blob,
    signal: AbortSignal.timeout(timeoutMs),
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
