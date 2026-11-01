import { createHash } from 'node:crypto'
import { SyncBody, SyncResponse } from '@exam/contracts'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import { forwardAttempt, type Upstream } from './forwarder.ts'
import type { HubStore } from './store.ts'

const SYNC = /^\/api\/attempts\/([0-9a-f-]{36})\/sync$/
/** Headers that describe one hop, not the request: never passed on. */
const HOP = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive'])

const cookieHash = (request: FastifyRequest) =>
  createHash('sha256')
    .update(request.headers.cookie ?? '')
    .digest('hex')

/**
 * A classroom hub (section 25.1): the same API in the edge role, between the room's devices and the cloud.
 * Every request goes through to the cloud. When the building loses the internet, a device's event sync is
 * answered by the hub itself: the sealed events are kept on the hub and acknowledged, and the forwarder
 * delivers them later. Only the student whose session last synced that attempt through the cloud may add to
 * it, and the cloud verifies every event with keys the hub never has, so the hub cannot alter anything.
 */
export function buildHub({ store, upstream }: { store: HubStore; upstream: Upstream }) {
  const app = Fastify({ logger: false, bodyLimit: 4 * 1024 * 1024 })
  app.removeAllContentTypeParsers()
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, body, done) => done(null, body))

  app.get('/health', async () => ({ ok: true }))
  app.all('/api/*', async (request, reply) => {
    const attemptId = request.method === 'POST' ? SYNC.exec(request.url)?.[1] : undefined
    try {
      // The cloud first gets what the hub collected, so events arrive in order.
      if (attemptId) await forwardAttempt(store, upstream, attemptId)
      const response = await pass(request, upstream, attemptId ? 10_000 : 60_000)
      if (attemptId && response.ok) return remember(reply, response, attemptId, cookieHash(request))
      return relay(reply, response)
    } catch {
      if (attemptId) return keep(request, reply, attemptId)
      return reply.code(503).send({ message: 'The cloud is unreachable from this room' })
    }
  })

  /** A sync answered by the cloud: remembered, so the hub can answer alike while the cloud is away. */
  async function remember(reply: FastifyReply, response: Response, attemptId: string, hash: string) {
    const last = SyncResponse.parse(await response.json())
    await store.update(attemptId, async (state) => ({
      cookieHash: hash,
      last,
      pending: (state?.pending ?? []).filter((p) => p.event.seq > last.ackedSeq),
    }))
    return reply.code(response.status).send(last)
  }

  /** No cloud: keep the events in order after what is already kept, and acknowledge them. */
  async function keep(request: FastifyRequest, reply: FastifyReply, attemptId: string) {
    const parsed = SyncBody.safeParse(JSON.parse(String(request.body || '{}')))
    if (!parsed.success) return reply.code(400).send({ message: 'Bad events' })
    let answer: SyncResponse | null = null
    await store.update(attemptId, async (state) => {
      // An attempt this session never synced through the cloud is not the hub's to hold.
      if (!state || state.cookieHash !== cookieHash(request)) return null
      let head = state.pending.at(-1)?.event.seq ?? state.last.ackedSeq
      const pending = [...state.pending]
      for (const event of parsed.data.events.toSorted((a, b) => a.seq - b.seq)) {
        if (event.seq !== head + 1) continue
        pending.push({ event, receivedAt: Date.now() })
        head = event.seq
      }
      answer = { ...state.last, ackedSeq: head, serverTime: Date.now(), commands: [] }
      return { ...state, pending }
    })
    return answer
      ? reply.send(answer)
      : reply.code(503).send({ message: 'The cloud is unreachable from this room' })
  }

  return app
}

/** The request as it came, to the cloud. */
function pass(request: FastifyRequest, upstream: Upstream, timeoutMs: number) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers))
    if (!HOP.has(name) && value !== undefined) headers.set(name, String(value))
  const body = request.body as Buffer | undefined
  return fetch(`${upstream.url()}${request.url}`, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) || !body ? undefined : new Uint8Array(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
}

/** The cloud's answer as it came, cookies included (sign-in goes through the hub too). */
async function relay(reply: FastifyReply, response: Response) {
  response.headers.forEach((value, name) => {
    if (!HOP.has(name) && name !== 'set-cookie') reply.header(name, value)
  })
  for (const cookie of response.headers.getSetCookie()) reply.header('set-cookie', cookie)
  return reply.code(response.status).send(Buffer.from(await response.arrayBuffer()))
}
