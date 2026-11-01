import { createHash } from 'node:crypto'
import { SyncBody, SyncResponse } from '@exam/contracts'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import {
  INLINE_FORWARD_MS,
  SYNC_BUDGET_MS,
  cloudHealth,
  isNetworkError,
  pass,
  relay,
  type Upstream,
} from './cloud.ts'
import { forwardAttempt } from './forwarder.ts'
import type { HubStore } from './store.ts'

const SYNC = /^\/api\/attempts\/([0-9a-f-]{36})\/sync$/
const OPEN = ['active', 'terminated']

/** The student's session (the `sid` cookie) that may add to an attempt kept on the hub. */
const sessionHash = (request: FastifyRequest) =>
  createHash('sha256')
    .update(/(?:^|;\s*)sid=([^;]*)/.exec(request.headers.cookie ?? '')?.[1] ?? '')
    .digest('hex')

/**
 * A classroom hub (section 25.1): the same API in the edge role, between the room's devices and the cloud.
 * Every request goes through to the cloud. When the building loses the internet, a device's event sync is
 * answered by the hub: the sealed events are kept on the hub (`relayedSeq`), the device keeps them too until
 * the cloud has them, and the forwarder delivers them later. Only the session that last synced that attempt
 * through the cloud may add to it, and the cloud verifies every event with keys the hub never holds.
 */
export function buildHub({ store, upstream }: { store: HubStore; upstream: Upstream }) {
  // Above every cloud limit (recorded chunks are up to 5 MB): the cloud decides what is too large.
  const app = Fastify({ logger: false, bodyLimit: 8 * 1024 * 1024 })
  const health = cloudHealth()
  app.removeAllContentTypeParsers()
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, body, done) => done(null, body))

  app.get('/health', async () => ({ ok: true, cloud: !health.down() }))
  app.all('/api/*', async (request, reply) => {
    const attemptId = request.method === 'POST' ? SYNC.exec(request.url)?.[1] : undefined
    if (attemptId && health.down()) return keep(request, reply, attemptId)
    try {
      // The cloud first gets what the hub collected, so events arrive in order.
      // Brief and best effort: a slow delivery is left to the forwarder's passes, never taken for an outage.
      if (attemptId) await forwardAttempt(store, upstream, attemptId, INLINE_FORWARD_MS).catch(logRefusal)
      const stream = request.url.endsWith('/stream')
      const response = await pass(request, upstream, stream ? null : attemptId ? SYNC_BUDGET_MS : 60_000)
      health.answered()
      if (attemptId && response.ok) return remember(reply, response, attemptId, sessionHash(request))
      return relay(reply, response)
    } catch (error) {
      if (!isNetworkError(error)) throw error
      health.failed()
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
      clockOffset: last.serverTime - Date.now(),
      pending: (state?.pending ?? []).filter((p) => p.event.seq > last.ackedSeq),
    }))
    return reply.code(response.status).send(last)
  }

  /** No cloud: keep the events in order after what is already kept, and say how far the hub holds them. */
  async function keep(request: FastifyRequest, reply: FastifyReply, attemptId: string) {
    const parsed = SyncBody.safeParse(JSON.parse(String(request.body || '{}')))
    if (!parsed.success) return reply.code(400).send({ message: 'Bad events' })
    let answer: SyncResponse | null = null
    await store.update(attemptId, async (state) => {
      // Not this session's attempt, or one the cloud takes nothing more for: not the hub's to hold.
      if (!state || state.cookieHash !== sessionHash(request)) return null
      if (!OPEN.includes(state.last.status) || state.last.chainBroken) return null
      // The cloud's clock, not the mini-PC's: a hub running slow must not move the exam's deadline.
      const now = () => Date.now() + (state.clockOffset ?? 0)
      let head = state.pending.at(-1)?.event.seq ?? state.last.ackedSeq
      const pending = [...state.pending]
      for (const event of parsed.data.events.toSorted((a, b) => a.seq - b.seq)) {
        if (event.seq !== head + 1) continue
        pending.push({ event, receivedAt: now() })
        head = event.seq
      }
      answer = { ...state.last, relayedSeq: head, serverTime: now(), commands: [] }
      return { ...state, pending }
    })
    return answer
      ? reply.send(answer)
      : reply.code(503).send({ message: 'The cloud is unreachable from this room' })
  }

  return app
}

/** The inline relay failed: whatever the reason, the device's own sync still goes to the cloud. */
function logRefusal(error: unknown) {
  if (!isNetworkError(error)) console.error('relay refused', error)
}
