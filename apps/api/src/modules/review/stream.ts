import type { ServerResponse } from 'node:http'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Deps } from '../../deps.ts'
import { currentUser } from '../auth/guard.ts'
import { ownExam } from './access.ts'
import { createLiveUpdates } from './live-updates.ts'

const HEARTBEAT_MS = 25_000

/**
 * GET /examiner/exams/:id/stream — Server-Sent Events for the monitoring page: one `attempt` event per
 * changed attempt, and a `resync` event when notifications may have been missed (the database link
 * dropped). The page reloads the list on each; a comment line every 25 s keeps idle proxies open.
 */
export function registerStream(app: FastifyInstance, deps: Deps) {
  const open = new Set<ServerResponse>()
  const live = createLiveUpdates(deps.listen, () => open.forEach((res) => send(res, 'resync', {})))
  // Streams never go idle, so the server would wait for them forever on shutdown.
  app.addHook('preClose', async () => open.forEach((res) => res.end()))

  const schema = { params: z.object({ id: z.uuid() }) }
  app.get<{ Params: { id: string } }>('/examiner/exams/:id/stream', { schema }, async (request, reply) => {
    const exam = await ownExam(deps.db, currentUser(request).id, request.params.id)
    const res = reply.raw
    const unsubscribe = await live.subscribe(exam.id, (attemptId) => send(res, 'attempt', { attemptId }))
    reply.hijack()
    // The client may have gone while we waited: its close event has already fired.
    if (res.destroyed) return unsubscribe()

    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-accel-buffering': 'no', // nginx: do not buffer
    })
    res.write('retry: 5000\n\n')
    open.add(res)
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS)
    res.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
      open.delete(res)
    })
  })
}

function send(res: ServerResponse, event: string, data: object) {
  if (!res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}
