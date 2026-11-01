import { ExamPackage, StartCode } from '@exam/contracts'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { ModuleOptions } from '../../deps.ts'
import { currentUser, requireRole } from '../auth/guard.ts'
import { examPackage, examinerStartCode } from './service.ts'

const params = z.object({ id: z.uuid() })

export const preloadRoutes: FastifyPluginAsyncZod<ModuleOptions> = async (app, { deps }) => {
  app.get(
    '/exams/:id/package',
    {
      onRequest: requireRole('student'),
      // A device downloads a package when it is missing or outdated; anything more is a misbehaving client.
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
          keyGenerator: (request) => request.user?.id ?? request.ip,
        },
      },
      schema: { params, response: { 200: ExamPackage } },
    },
    async (request) => examPackage(deps, currentUser(request).id, request.params.id),
  )
  app.get(
    '/examiner/exams/:id/start-code',
    { onRequest: requireRole('examiner'), schema: { params, response: { 200: StartCode } } },
    async (request) => examinerStartCode(deps, currentUser(request).id, request.params.id),
  )
}
