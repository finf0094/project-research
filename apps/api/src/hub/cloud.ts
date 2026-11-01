import { Readable } from 'node:stream'
import type { FastifyReply, FastifyRequest } from 'fastify'

export interface Upstream {
  /** The cloud's base URL, e.g. https://exam.university.kz */
  url(): string
  token: string
}

/** Headers that describe one hop, not the request: never passed on. */
// fetch has already decoded a compressed body, so its encoding must not be announced again.
const HOP = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'keep-alive',
  'content-encoding',
])
/** An outside link that stalls is as bad as one that fails: a device's sync gives up after 10 s. */
export const SYNC_BUDGET_MS = 3000
/** Delivering what the hub holds before a device's sync: brief, so the device still gets an answer in time. */
export const INLINE_FORWARD_MS = 1500
/** After a failure the cloud is not tried for this long, so devices get the hub's answer at once. */
const DOWN_FOR_MS = 15_000

/** Whether the cloud answered lately; a failure marks it down for a while. */
export function cloudHealth(now = () => Date.now()) {
  let downUntil = 0
  return {
    down: () => now() < downUntil,
    failed: () => void (downUntil = now() + DOWN_FOR_MS),
    answered: () => void (downUntil = 0),
  }
}

/** Errors that mean "no cloud" (no connection, a timeout), as opposed to the cloud saying no. */
export const isNetworkError = (error: unknown) =>
  error instanceof TypeError ||
  (error instanceof DOMException && ['TimeoutError', 'AbortError'].includes(error.name))

/** The request as it came, to the cloud. Streams (live monitoring) get no time limit. */
export function pass(request: FastifyRequest, upstream: Upstream, timeoutMs: number | null) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers))
    if (!HOP.has(name) && value !== undefined) headers.set(name, String(value))
  const body = request.body as Buffer | undefined
  return fetch(`${upstream.url()}${request.url}`, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) || !body ? undefined : new Uint8Array(body),
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
  })
}

/** The cloud's answer as it came, cookies included, streamed (so live monitoring works through the hub). */
export function relay(reply: FastifyReply, response: Response) {
  response.headers.forEach((value, name) => {
    if (!HOP.has(name) && name !== 'set-cookie') reply.header(name, value)
  })
  for (const cookie of response.headers.getSetCookie()) reply.header('set-cookie', cookie)
  reply.code(response.status)
  return response.body ? reply.send(Readable.fromWeb(response.body as never)) : reply.send()
}
