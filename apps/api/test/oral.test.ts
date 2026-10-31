import type { AttemptSession, OralRoomAccess } from '@exam/contracts'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { attempts, questions } from '../src/db/schema.ts'
import { createTestContext, seedExam, signIn, type TestContext } from './helpers.ts'

let ctx: TestContext
let seeded: Awaited<ReturnType<typeof seedExam>>
let student: { cookie: string }
let examiner: { cookie: string }

beforeEach(async () => {
  ctx = await createTestContext()
  seeded = await seedExam(ctx, { mode: 'oral', recording: 'full', ticketSize: 1 })
  student = await signIn(ctx.app, 'student@test.edu')
  examiner = await signIn(ctx.app, 'teacher@test.edu')
})
afterEach(() => ctx.close())

function configureLiveKit() {
  ctx.deps.config = {
    ...ctx.deps.config,
    LIVEKIT_URL: 'wss://live.test',
    LIVEKIT_API_KEY: 'key',
    LIVEKIT_API_SECRET: 'a-secret-long-enough-for-hmac-signing-0123',
  }
}

async function start(): Promise<AttemptSession> {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/attempts',
    headers: student,
    payload: { examId: seeded.exam.id },
  })
  expect(res.statusCode, res.body).toBe(200)
  return res.json()
}

/** Reads a JWT payload without verifying it (the signature is LiveKit's business). */
const decodeJwt = (jwt: string) => JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64url').toString())

const token = (url: string, headers: { cookie: string }) => ctx.app.inject({ method: 'POST', url, headers })

describe('oral ticket', () => {
  it('draws a ticket from the pool once and keeps it on resume', async () => {
    const first = await start()
    expect(first.exam.questions).toHaveLength(1)
    const pool = (await ctx.deps.db.select().from(questions)).map((q) => q.id)
    expect(pool).toContain(first.exam.questions[0]!.id)
    const again = await start()
    expect(again.exam.questions.map((q) => q.id)).toEqual(first.exam.questions.map((q) => q.id))
  })

  it('lists the oral exam with the ticket size, not the pool size', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/exams', headers: student })
    expect(res.json()).toEqual([expect.objectContaining({ mode: 'oral', questionCount: 1 })])
  })
})

describe('oral room tokens', () => {
  it('answers 503 while live video is not configured', async () => {
    const { attemptId } = await start()
    expect((await token(`/api/attempts/${attemptId}/oral/token`, student)).statusCode).toBe(503)
  })

  it('lets the student and the examiner into the same room of the attempt', async () => {
    configureLiveKit()
    const { attemptId } = await start()
    const mine: OralRoomAccess = (await token(`/api/attempts/${attemptId}/oral/token`, student)).json()
    const theirs: OralRoomAccess = (
      await token(`/api/examiner/attempts/${attemptId}/oral/token`, examiner)
    ).json()
    expect(mine.room).toBe(`attempt-${attemptId}`)
    expect(theirs.room).toBe(mine.room)
    expect(decodeJwt(mine.token)).toMatchObject({
      sub: `student:${seeded.student.id}`,
      video: { room: mine.room },
    })
    expect(decodeJwt(theirs.token).sub).toBe(`examiner:${seeded.examiner.id}`)
  })

  it('keeps other people out and closes the room after the attempt ends', async () => {
    configureLiveKit()
    const { attemptId } = await start()
    const outsider = await signIn(ctx.app, 'outsider@test.edu')
    expect((await token(`/api/attempts/${attemptId}/oral/token`, outsider)).statusCode).toBe(404)
    expect((await token(`/api/examiner/attempts/${attemptId}/oral/token`, student)).statusCode).toBe(403)
    await ctx.deps.db.update(attempts).set({ status: 'submitted' }).where(eq(attempts.id, attemptId))
    expect((await token(`/api/attempts/${attemptId}/oral/token`, student)).statusCode).toBe(409)
  })
})

describe('oral grading', () => {
  it('stores the examiner score with the decision', async () => {
    const { attemptId } = await start()
    await ctx.deps.db.update(attempts).set({ status: 'ready_for_review' }).where(eq(attempts.id, attemptId))
    const put = await ctx.app.inject({
      method: 'PUT',
      url: `/api/examiner/attempts/${attemptId}/decision`,
      headers: examiner,
      payload: { verdict: 'clean', comment: 'Уверенный ответ', score: 9 },
    })
    expect(put.statusCode, put.body).toBe(204)
    const detail = await ctx.app.inject({
      method: 'GET',
      url: `/api/examiner/attempts/${attemptId}`,
      headers: examiner,
    })
    expect(detail.json()).toMatchObject({ examMode: 'oral', decision: { score: 9 } })
  })
})
