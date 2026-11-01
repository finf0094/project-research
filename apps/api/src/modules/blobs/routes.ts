import { Sha256 } from '@exam/contracts'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { ModuleOptions } from '../../deps.ts'
import { HttpError, badRequest } from '../../shared/errors.ts'
import { currentUser, requireRole } from '../auth/guard.ts'
import { chunkMime } from './mime.ts'
import { MAX_CHUNK_BYTES, putChunk } from './service.ts'

export const blobsRoutes: FastifyPluginAsyncZod<ModuleOptions> = async (app, { deps }) => {
  // A Blob without a type is sent with an empty Content-Type, which Fastify refuses before any parser.
  app.addHook('onRequest', async (request) => {
    if (!request.headers['content-type']?.trim()) delete request.headers['content-type']
  })
  // Any type (only this plugin's route): the chunk's bytes decide, see chunkMime.
  app.addContentTypeParser('*', { parseAs: 'buffer', bodyLimit: MAX_CHUNK_BYTES }, (_req, body, done) =>
    done(null, body),
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
      // Safari can record an empty chunk: it must never count as an uploaded recording.
      if (request.body.length === 0) throw badRequest('Empty chunk')
      const mime = chunkMime(request.headers['content-type'], request.body)
      if (!mime) throw new HttpError(415, 'Expected a WebM or MP4 recording')
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
