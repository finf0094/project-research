import { StudentExamListItem } from '@exam/contracts'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { ModuleOptions } from '../../deps.ts'
import { currentUser, requireRole } from '../auth/guard.ts'
import { listForStudent } from './service.ts'

export const examsRoutes: FastifyPluginAsyncZod<ModuleOptions> = async (app, { deps }) => {
  app.get(
    '/exams',
    { schema: { response: { 200: z.array(StudentExamListItem) } }, onRequest: requireRole('student') },
    async (request) => listForStudent(deps.db, currentUser(request).id),
  )
}
