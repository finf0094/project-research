import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AttemptSession, Event, ExamProfile } from '@exam/contracts'
import { importHmacKeyBase64, seal } from '@exam/integrity'
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.ts'
import { loadConfig } from '../src/config.ts'
import { createDb } from '../src/db/client.ts'
import { examParticipants, exams, questions, users } from '../src/db/schema.ts'
import type { Deps } from '../src/deps.ts'
import { hashPassword } from '../src/modules/auth/service.ts'
import { fsStorage } from '../src/shared/storage.ts'
import { TEST_DATABASE_URL } from './global-setup.ts'

export const PASSWORD = 'secret-pass'

export interface TestContext {
  app: FastifyInstance
  deps: Deps
  clock: { now: number }
  close(): Promise<void>
}

export async function createTestContext(): Promise<TestContext> {
  const config = loadConfig({
    DATABASE_URL: TEST_DATABASE_URL,
    MASTER_KEY: Buffer.alloc(32, 1).toString('base64'),
    COOKIE_SECURE: 'false',
  })
  const { db, close } = createDb(config.DATABASE_URL)
  const clock = { now: Date.UTC(2026, 10, 2, 9, 0) }
  const deps: Deps = {
    db,
    config,
    storage: fsStorage(await mkdtemp(join(tmpdir(), 'exam-storage-'))),
    masterKey: Buffer.from(config.MASTER_KEY, 'base64'),
    now: () => clock.now,
  }
  // The event log refuses TRUNCATE (append-only trigger); tests switch the guard off only while resetting.
  await db.execute(sql`alter table events disable trigger events_no_truncate`)
  await db.execute(sql`truncate users, exams, sessions cascade`)
  await db.execute(sql`alter table events enable trigger events_no_truncate`)
  const app = await buildApp(deps, { logger: false })
  return { app, deps, clock, close: async () => (await app.close(), await close()) }
}

const passwordHash = await hashPassword(PASSWORD)

/** Creates an examiner, a student enrolled in a 60-minute exam and a non-enrolled student. */
export async function seedExam(
  { deps, clock }: TestContext,
  profile: ExamProfile = { mode: 'written', recording: 'adaptive' },
) {
  const [examiner, student, outsider] = await deps.db
    .insert(users)
    .values([
      { email: 'teacher@test.edu', name: 'Teacher', role: 'examiner', passwordHash },
      { email: 'student@test.edu', name: 'Student', role: 'student', passwordHash },
      { email: 'outsider@test.edu', name: 'Outsider', role: 'student', passwordHash },
    ])
    .returning()
  const [exam] = await deps.db
    .insert(exams)
    .values({
      title: 'Test exam',
      durationMin: 60,
      opensAt: new Date(clock.now - 60_000),
      closesAt: new Date(clock.now + 86_400_000),
      profile,
      ownerId: examiner!.id,
    })
    .returning()
  const [single, text] = await deps.db
    .insert(questions)
    .values([
      {
        examId: exam!.id,
        position: 1,
        type: 'single',
        text: 'Q1',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correct: ['a'],
        points: 2,
      },
      { examId: exam!.id, position: 2, type: 'text', text: 'Q2', options: [], correct: [], points: 5 },
    ])
    .returning()
  await deps.db.insert(examParticipants).values({ examId: exam!.id, userId: student!.id })
  return {
    examiner: examiner!,
    student: student!,
    outsider: outsider!,
    exam: exam!,
    single: single!,
    text: text!,
  }
}

export async function signIn(app: FastifyInstance, email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: PASSWORD },
  })
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.body}`)
  const cookie = res.cookies.find((c) => c.name === 'sid')!
  return { cookie: `sid=${cookie.value}` }
}

/** Plays the client: seals events into the attempt's chain exactly like the browser does. */
export async function clientChain(session: AttemptSession) {
  const key = await importHmacKeyBase64(session.hmacKey)
  let head = { seq: session.ackedSeq, hash: session.lastHash }
  return {
    get head() {
      return head
    },
    async next(type: Event['type'], data: unknown, at: number): Promise<Event> {
      const event = await seal({ seq: head.seq + 1, type, data, at }, head.hash, key)
      head = { seq: event.seq, hash: event.hash }
      return event as Event
    },
  }
}
