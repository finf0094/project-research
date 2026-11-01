import { timingSafeEqual } from 'node:crypto'
import { HubBatch, SyncBody, SyncResponse } from '@exam/contracts'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { ModuleOptions } from '../../deps.ts'
import { HttpError, unauthorized } from '../../shared/errors.ts'
import { currentUser, requireRole } from '../auth/guard.ts'
import { acceptEvents } from './accept.ts'

export const syncRoutes: FastifyPluginAsyncZod<ModuleOptions> = async (app, { deps }) => {
  app.post(
    '/attempts/:id/sync',
    {
      onRequest: requireRole('student'),
      // A batch of 100 long text answers can exceed the default 1 MB.
      bodyLimit: 4 * 1024 * 1024,
      // Clients sync every few seconds; this only stops runaway loops. Keyed per user, not per (shared) IP.
      config: {
        rateLimit: {
          max: 120,
          timeWindow: '1 minute',
          keyGenerator: (request) => request.user?.id ?? request.ip,
        },
      },
      schema: { params: z.object({ id: z.uuid() }), body: SyncBody, response: { 200: SyncResponse } },
    },
    async (request) => acceptEvents(deps, currentUser(request).id, request.params.id, request.body.events),
  )

  // A classroom hub delivers what it collected offline. It proves itself with the shared token; what it
  // delivers is checked like any client's (the chain and its keys), so a hub cannot alter an event.
  app.post(
    '/hub/attempts/:id/events',
    {
      bodyLimit: 4 * 1024 * 1024,
      schema: {
        hide: true,
        params: z.object({ id: z.uuid() }),
        body: HubBatch,
        response: { 200: SyncResponse },
      },
    },
    async (request) => {
      const token = deps.config.HUB_TOKEN
      if (!token) throw new HttpError(404, 'Not found')
      const given = Buffer.from(request.headers.authorization?.replace(/^Bearer /, '') ?? '')
      const expected = Buffer.from(token)
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw unauthorized()
      const { events } = request.body
      const relayedAt = new Map(events.map((e) => [e.event.seq, e.receivedAt]))
      // 410 tells the hub the attempt is gone for good (a plain 404 could also be a misconfiguration).
      const batch = events.map((e) => e.event)
      return acceptEvents(deps, null, request.params.id, batch, relayedAt).catch((error: unknown) => {
        if (error instanceof HttpError && error.statusCode === 404)
          throw new HttpError(410, 'Attempt removed')
        throw error
      })
    },
  )
}
