import type { Role, User } from '@exam/contracts'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { Deps } from '../../deps.ts'
import { forbidden, unauthorized } from '../../shared/errors.ts'
import { userBySession } from './service.ts'

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null
  }
}

export const SESSION_COOKIE = 'sid'

/** Resolves the session cookie into request.user. Must be called on the root instance so every module sees it. */
export function installAuth(app: FastifyInstance, { db, now }: Pick<Deps, 'db' | 'now'>) {
  app.decorateRequest('user', null)
  app.addHook('onRequest', async (request) => {
    const token = request.cookies[SESSION_COOKIE]
    request.user = token ? await userBySession(db, token, now()) : null
  })
}

/** A route hook (used as onRequest) that admits only signed-in users with the given role. */
export function requireRole(role: Role) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user) throw unauthorized()
    if (request.user.role !== role) throw forbidden()
  }
}

/** Narrows `request.user` after `requireRole` has run. */
export function currentUser(request: FastifyRequest): User {
  if (!request.user) throw unauthorized()
  return request.user
}
