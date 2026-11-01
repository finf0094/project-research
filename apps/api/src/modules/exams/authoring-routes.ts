import {
  AuthoredExam,
  ExamDefinition,
  ParticipantsBody,
  ParticipantsResult,
  SignalException,
} from '@exam/contracts'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { ModuleOptions } from '../../deps.ts'
import { currentUser, requireRole } from '../auth/guard.ts'
import { authoredExam, createExam, setParticipants, updateExam } from './authoring.ts'
import { setException } from './exceptions.ts'

const IdParams = z.object({ id: z.uuid() })

/** Exam authoring for examiners: create, read and replace their own exams, and choose the participants. */
export const authoringRoutes: FastifyPluginAsyncZod<ModuleOptions> = async (app, { deps }) => {
  app.addHook('onRequest', requireRole('examiner'))
  const me = (request: Parameters<typeof currentUser>[0]) => currentUser(request).id

  app.post(
    '/examiner/exams',
    { schema: { body: ExamDefinition, response: { 200: z.object({ id: z.uuid() }) } } },
    async (request) => createExam(deps.db, me(request), request.body),
  )

  app.get(
    '/examiner/exams/:id/definition',
    { schema: { params: IdParams, response: { 200: AuthoredExam } } },
    async (request) => authoredExam(deps.db, me(request), request.params.id, deps.now()),
  )

  app.put(
    '/examiner/exams/:id/definition',
    { schema: { params: IdParams, body: ExamDefinition } },
    async (request, reply) => {
      await updateExam(deps.db, me(request), request.params.id, request.body, deps.now())
      return reply.code(204).send()
    },
  )

  app.put(
    '/examiner/exams/:id/exceptions',
    { schema: { params: IdParams, body: SignalException } },
    async (request, reply) => {
      await setException(deps.db, me(request), request.params.id, request.body)
      return reply.code(204).send()
    },
  )

  app.put(
    '/examiner/exams/:id/participants',
    { schema: { params: IdParams, body: ParticipantsBody, response: { 200: ParticipantsResult } } },
    async (request) => setParticipants(deps.db, me(request), request.params.id, request.body.emails),
  )
}
