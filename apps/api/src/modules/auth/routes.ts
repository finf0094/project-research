import { LoginBody, User } from '@exam/contracts'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { ModuleOptions } from '../../deps.ts'
import { unauthorized } from '../../shared/errors.ts'
import { SESSION_COOKIE, currentUser } from './guard.ts'
import { login, logout } from './service.ts'

export const authRoutes: FastifyPluginAsyncZod<ModuleOptions> = async (app, { deps }) => {
  const { db, config, now } = deps

  app.post(
    '/auth/login',
    {
      schema: { body: LoginBody, response: { 200: User } },
      // Per address, loose: a classroom behind one address signs in at once, password spraying is slowed.
      config: { rateLimit: { max: 300, timeWindow: '1 minute' } },
      // Per account, tight, from any address: guessing one student's password is slowed.
      preHandler: app.rateLimit({
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (request) => `login:${(request.body as LoginBody).email.toLowerCase()}`,
      }),
    },
    async (request, reply) => {
      const result = await login(
        db,
        request.body.email,
        request.body.password,
        config.SESSION_TTL_HOURS,
        now(),
      )
      if (!result) throw unauthorized()
      reply.setCookie(SESSION_COOKIE, result.token, {
        httpOnly: true,
        secure: config.COOKIE_SECURE,
        sameSite: 'strict',
        path: '/',
        maxAge: config.SESSION_TTL_HOURS * 3600,
      })
      return result.user
    },
  )

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE]
    if (token) await logout(db, token)
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return reply.code(204).send()
  })

  app.get('/auth/me', { schema: { response: { 200: User } } }, async (request) => currentUser(request))
}
