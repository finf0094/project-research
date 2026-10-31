import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Deps } from '../../deps.ts'
import { currentUser } from '../auth/guard.ts'
import { ownExam } from './access.ts'
import { createLiveUpdates } from './live-updates.ts'

const HEARTBEAT_MS = 25_000

/**
 * GET /examiner/exams/:id/stream — Server-Sent Events for the monitoring page: one `attempt` event per
 * changed attempt (status, connection, risk, deadline). The page reloads the list on each; a comment
 * line every 25 s keeps proxies from closing the idle connection.
 */
export function registerStream(app: FastifyInstance, deps: Deps) {
  const live = createLiveUpdates(deps.listen)

  const schema = { params: z.object({ id: z.uuid() }) }
  app.get<{ Params: { id: string } }>('/examiner/exams/:id/stream', { schema }, async (request, reply) => {
    const exam = await ownExam(deps.db, currentUser(request).id, request.params.id)
    const unsubscribe = await live.subscribe(exam.id, (attemptId) =>
      reply.raw.write(`event: attempt\ndata: ${JSON.stringify({ attemptId })}\n\n`),
    )
    reply.hijack()
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      // Caddy and nginx must pass events on at once instead of buffering them.
      'x-accel-buffering': 'no',
    })
    reply.raw.write('retry: 5000\n\n')
    const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), HEARTBEAT_MS)
    request.raw.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
    })
  })
}
