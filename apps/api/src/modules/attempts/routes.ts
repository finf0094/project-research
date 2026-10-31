import { AttemptSession, AttemptStatus, StartAttemptBody, SubmitBody } from '@exam/contracts'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { ModuleOptions } from '../../deps.ts'
import { currentUser, requireRole } from '../auth/guard.ts'
import { getSession, startAttempt, submitAttempt } from './service.ts'

const AttemptParams = z.object({ id: z.uuid() })

export const attemptsRoutes: FastifyPluginAsyncZod<ModuleOptions> = async (app, { deps }) => {
  app.addHook('onRequest', requireRole('student'))

  app.post(
    '/attempts',
    { schema: { body: StartAttemptBody, response: { 200: AttemptSession } } },
    async (request) => startAttempt(deps, currentUser(request).id, request.body.examId),
  )

  app.get(
    '/attempts/:id',
    { schema: { params: AttemptParams, response: { 200: AttemptSession } } },
    async (request) => getSession(deps, currentUser(request).id, request.params.id),
  )

  app.post(
    '/attempts/:id/submit',
    {
      schema: {
        params: AttemptParams,
        body: SubmitBody,
        response: { 200: z.object({ status: AttemptStatus }) },
      },
    },
    async (request) => submitAttempt(deps, currentUser(request).id, request.params.id, request.body),
  )
}
