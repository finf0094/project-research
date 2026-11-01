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
      // Per address and account: guessing one password is slowed, a room behind one address is not.
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
          keyGenerator: (request) => `${request.ip}|${(request.body as { email?: unknown } | null)?.email}`,
        },
      },
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
