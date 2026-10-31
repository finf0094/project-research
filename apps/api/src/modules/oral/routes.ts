import { OralRoomAccess } from '@exam/contracts'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { ModuleOptions } from '../../deps.ts'
import { currentUser, requireRole } from '../auth/guard.ts'
import { examinerRoomAccess, studentRoomAccess } from './service.ts'

const schema = { params: z.object({ id: z.uuid() }), response: { 200: OralRoomAccess } }

export const oralRoutes: FastifyPluginAsyncZod<ModuleOptions> = async (app, { deps }) => {
  app.post('/attempts/:id/oral/token', { onRequest: requireRole('student'), schema }, async (request) =>
    studentRoomAccess(deps, currentUser(request), request.params.id),
  )
  app.post(
    '/examiner/attempts/:id/oral/token',
    { onRequest: requireRole('examiner'), schema },
    async (request) => examinerRoomAccess(deps, currentUser(request), request.params.id),
  )
}
