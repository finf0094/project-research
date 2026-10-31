import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod'
import type { Deps } from './deps.ts'
import { HttpError } from './shared/errors.ts'
import { installAuth } from './modules/auth/guard.ts'
import { authRoutes } from './modules/auth/routes.ts'
import { attemptsRoutes } from './modules/attempts/routes.ts'
import { blobsRoutes } from './modules/blobs/routes.ts'
import { authoringRoutes } from './modules/exams/authoring-routes.ts'
import { examsRoutes } from './modules/exams/routes.ts'
import { oralRoutes } from './modules/oral/routes.ts'
import { reviewRoutes } from './modules/review/routes.ts'
import { syncRoutes } from './modules/sync/routes.ts'
import { usersRoutes } from './modules/users/routes.ts'

export async function buildApp(deps: Deps, { logger = true } = {}) {
  const app = Fastify({
    logger,
    bodyLimit: 1024 * 1024,
    trustProxy: deps.config.TRUST_PROXY,
  }).withTypeProvider<ZodTypeProvider>()
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  // Client errors keep their message; server errors are logged and never leak SQL or data to the client.
  app.setErrorHandler((error: { statusCode?: number; message: string }, request, reply) => {
    const status = error.statusCode ?? 500
    if (status >= 500) request.log.error(error)
    // Our own HttpErrors carry a safe message (even a 503); anything else that fails is hidden.
    if (status >= 500 && !(error instanceof HttpError)) {
      return reply.code(500).send({ message: 'Internal server error' })
    }
    return reply.code(status).send({ message: error.message })
  })

  await app.register(cookie)
  await app.register(rateLimit, { global: false })
  installAuth(app, deps)

  app.get('/health', async () => ({ ok: true }))
  for (const module of [
    authRoutes,
    examsRoutes,
    attemptsRoutes,
    syncRoutes,
    blobsRoutes,
    reviewRoutes,
    oralRoutes,
    authoringRoutes,
    usersRoutes,
  ]) {
    await app.register(module, { prefix: '/api', deps })
  }
  return app
}
