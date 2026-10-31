import type { NewUser, UserListItem } from '@exam/contracts'
import { asc } from 'drizzle-orm'
import type { Db } from '../../db/client.ts'
import { users } from '../../db/schema.ts'
import { conflict } from '../../shared/errors.ts'
import { hashPassword } from '../auth/service.ts'

export async function listUsers(db: Db): Promise<UserListItem[]> {
  return db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .orderBy(asc(users.role), asc(users.email))
}

/** Accounts are created by the administrator (no self sign-up: a university knows its students). */
export async function createUser(db: Db, input: NewUser): Promise<UserListItem> {
  const [user] = await db
    .insert(users)
    .values({
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      role: input.role,
      passwordHash: await hashPassword(input.password),
    })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role })
  if (!user) throw conflict('A user with this email already exists')
  return user
}
