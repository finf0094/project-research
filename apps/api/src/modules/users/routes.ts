import { NewUser, UserListItem } from '@exam/contracts'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { ModuleOptions } from '../../deps.ts'
import { requireRole } from '../auth/guard.ts'
import { createUser, listUsers } from './service.ts'

/** User administration: the administrator's only job in this version. */
export const usersRoutes: FastifyPluginAsyncZod<ModuleOptions> = async (app, { deps }) => {
  app.addHook('onRequest', requireRole('admin'))

  app.get('/admin/users', { schema: { response: { 200: z.array(UserListItem) } } }, async () =>
    listUsers(deps.db),
  )

  app.post('/admin/users', { schema: { body: NewUser, response: { 200: UserListItem } } }, async (request) =>
    createUser(deps.db, request.body),
  )
}
