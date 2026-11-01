import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod'
import type { Deps } from './deps.ts'
import { registerDocs } from './docs.ts'
import { HttpError } from './shared/errors.ts'
import { installAuth } from './modules/auth/guard.ts'
import { authRoutes } from './modules/auth/routes.ts'
import { attemptsRoutes } from './modules/attempts/routes.ts'
import { blobsRoutes } from './modules/blobs/routes.ts'
import { authoringRoutes } from './modules/exams/authoring-routes.ts'
import { examsRoutes } from './modules/exams/routes.ts'
import { oralRoutes } from './modules/oral/routes.ts'
import { preloadRoutes } from './modules/preload/routes.ts'
import { resultsRoutes } from './modules/results/routes.ts'
import { reviewRoutes } from './modules/review/routes.ts'
import { syncRoutes } from './modules/sync/routes.ts'
import { usersRoutes } from './modules/users/routes.ts'

export async function buildApp(deps: Deps, { logger = true } = {}) {
  const app = Fastify({
    logger,
    bodyLimit: 1024 * 1024,
    // The nearest TRUST_PROXY hops are our proxies; what a client wrote further back is not believed.
    trustProxy: (_address: string, hop: number) => hop < deps.config.TRUST_PROXY,
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

  await registerDocs(app)
  await app.register(cookie)
  // After the body and the session are read, so limits can be per account: a classroom (or its hub) shares
  // one address, and a hundred students signing in at once must not lock each other out.
  await app.register(rateLimit, { global: false, hook: 'preHandler' })
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
    resultsRoutes,
    preloadRoutes,
  ]) {
    await app.register(module, { prefix: '/api', deps })
  }
  return app
}
