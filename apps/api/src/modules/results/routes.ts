import { StudentResult } from '@exam/contracts'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { ModuleOptions } from '../../deps.ts'
import { currentUser, requireRole } from '../auth/guard.ts'
import { studentResult } from './service.ts'

export const resultsRoutes: FastifyPluginAsyncZod<ModuleOptions> = async (app, { deps }) => {
  app.get(
    '/attempts/:id/result',
    {
      onRequest: requireRole('student'),
      schema: { params: z.object({ id: z.uuid() }), response: { 200: StudentResult } },
    },
    async (request) => studentResult(deps.db, currentUser(request).id, request.params.id),
  )
}
