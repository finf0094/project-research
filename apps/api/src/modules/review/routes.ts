import {
  AttemptDetail,
  AttemptSummary,
  DecisionBody,
  ExaminerCommandBody,
  ExaminerExam,
  Sha256,
  UpdateMarkerBody,
} from '@exam/contracts'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { ModuleOptions } from '../../deps.ts'
import { currentUser, requireRole } from '../auth/guard.ts'
import { attemptDetail, decide, readChunk, sendCommand, updateMarker } from './attempt-review.ts'
import { listAttempts } from './attempt-list.ts'
import { examSummary, listExams, publishResults } from './exam-summary.ts'
import { registerStream } from './stream.ts'

const IdParams = z.object({ id: z.uuid() })

export const reviewRoutes: FastifyPluginAsyncZod<ModuleOptions> = async (app, { deps }) => {
  app.addHook('onRequest', requireRole('examiner'))
  const me = (request: Parameters<typeof currentUser>[0]) => currentUser(request).id

  registerStream(app, deps)

  app.get('/examiner/exams', { schema: { response: { 200: z.array(ExaminerExam) } } }, async (request) =>
    listExams(deps, me(request)),
  )

  app.get(
    '/examiner/exams/:id',
    { schema: { params: IdParams, response: { 200: ExaminerExam } } },
    async (request) => examSummary(deps, me(request), request.params.id),
  )

  app.post('/examiner/exams/:id/publish', { schema: { params: IdParams } }, async (request, reply) => {
    await publishResults(deps, me(request), request.params.id)
    return reply.code(204).send()
  })

  app.get(
    '/examiner/exams/:id/attempts',
    { schema: { params: IdParams, response: { 200: z.array(AttemptSummary) } } },
    async (request) => listAttempts(deps, me(request), request.params.id),
  )

  app.get(
    '/examiner/attempts/:id',
    { schema: { params: IdParams, response: { 200: AttemptDetail } } },
    async (request) => attemptDetail(deps, me(request), request.params.id),
  )

  app.post(
    '/examiner/attempts/:id/commands',
    { schema: { params: IdParams, body: ExaminerCommandBody } },
    async (request, reply) => {
      await sendCommand(deps, me(request), request.params.id, request.body)
      return reply.code(204).send()
    },
  )

  app.put(
    '/examiner/attempts/:id/decision',
    { schema: { params: IdParams, body: DecisionBody } },
    async (request, reply) => {
      await decide(deps, me(request), request.params.id, request.body)
      return reply.code(204).send()
    },
  )

  app.patch(
    '/examiner/markers/:id',
    { schema: { params: IdParams, body: UpdateMarkerBody } },
    async (request, reply) => {
      await updateMarker(deps, me(request), request.params.id, request.body.status)
      return reply.code(204).send()
    },
  )

  app.get(
    '/examiner/attempts/:id/chunks/:hash',
    { schema: { params: z.object({ id: z.uuid(), hash: Sha256 }) } },
    async (request, reply) => {
      const { data, mime } = await readChunk(deps, me(request), request.params.id, request.params.hash)
      return reply
        .header('cache-control', 'private, max-age=3600')
        .header('x-content-type-options', 'nosniff')
        .type(mime)
        .send(data)
    },
  )
}
