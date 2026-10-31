import { createHash, randomBytes } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'
import type { User } from '@exam/contracts'
import { and, eq, gt } from 'drizzle-orm'
import type { Db } from '../../db/client.ts'
import { sessions, users } from '../../db/schema.ts'

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = await hash('timing-equalizer')

const sessionId = (token: string) => createHash('sha256').update(token).digest('hex')

export const hashPassword = (password: string) => hash(password)

export async function login(db: Db, email: string, password: string, ttlHours: number, now: number) {
  const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase()))
  const valid = await verify(row?.passwordHash ?? DUMMY_HASH, password)
  if (!row || !valid) return null

  const token = randomBytes(32).toString('base64url')
  await db.insert(sessions).values({
    id: sessionId(token),
    userId: row.id,
    expiresAt: new Date(now + ttlHours * 3_600_000),
  })
  return { token, user: toUser(row) }
}

export async function userBySession(db: Db, token: string, now: number): Promise<User | null> {
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sessionId(token)), gt(sessions.expiresAt, new Date(now))))
  return row ? toUser(row.user) : null
}

export async function logout(db: Db, token: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId(token)))
}

function toUser(row: typeof users.$inferSelect): User {
  return { id: row.id, email: row.email, name: row.name, role: row.role }
}
