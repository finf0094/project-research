import { Sha256 } from '@exam/contracts'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { ModuleOptions } from '../../deps.ts'
import { badRequest } from '../../shared/errors.ts'
import { currentUser, requireRole } from '../auth/guard.ts'
import { ALLOWED_MIME, MAX_CHUNK_BYTES, putChunk } from './service.ts'

export const blobsRoutes: FastifyPluginAsyncZod<ModuleOptions> = async (app, { deps }) => {
  app.addContentTypeParser(
    [...ALLOWED_MIME],
    { parseAs: 'buffer', bodyLimit: MAX_CHUNK_BYTES },
    (_req, body, done) => done(null, body),
  )

  app.put(
    '/attempts/:id/chunks/:hash',
    {
      onRequest: requireRole('student'),
      bodyLimit: MAX_CHUNK_BYTES,
      schema: { params: z.object({ id: z.uuid(), hash: Sha256 }) },
    },
    async (request, reply) => {
      if (!Buffer.isBuffer(request.body)) throw badRequest('Expected a video or audio chunk')
      const mime = (request.headers['content-type'] ?? '').split(';')[0]!.trim()
      await putChunk(
        deps,
        currentUser(request).id,
        request.params.id,
        request.params.hash,
        mime,
        request.body,
      )
      return reply.code(204).send()
    },
  )
}
