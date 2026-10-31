import { SyncBody, SyncResponse } from '@exam/contracts'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { ModuleOptions } from '../../deps.ts'
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
}
