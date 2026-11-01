import type { AttemptSession, SyncResponse } from '@exam/contracts'
import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { answers, attempts, events } from '../src/db/schema.ts'
import { clientChain, createTestContext, seedExam, signIn, type TestContext } from './helpers.ts'

let ctx: TestContext
let seeded: Awaited<ReturnType<typeof seedExam>>
let student: { cookie: string }

beforeEach(async () => {
  ctx = await createTestContext()
  seeded = await seedExam(ctx)
  student = await signIn(ctx.app, 'student@test.edu')
})
afterEach(() => ctx.close())

async function start(): Promise<AttemptSession> {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/attempts',
    headers: student,
    payload: { examId: seeded.exam.id },
  })
  expect(res.statusCode).toBe(200)
  return res.json()
}

async function sync(attemptId: string, events: unknown[]): Promise<SyncResponse> {
  const res = await ctx.app.inject({
    method: 'POST',
    url: `/api/attempts/${attemptId}/sync`,
    headers: student,
    payload: { events },
  })
  expect(res.statusCode, res.body).toBe(200)
  return res.json()
}

describe('auth', () => {
  it('rejects a wrong password and anonymous access', async () => {
    const bad = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'student@test.edu', password: 'nope' },
    })
    expect(bad.statusCode).toBe(401)
    expect((await ctx.app.inject({ method: 'GET', url: '/api/exams' })).statusCode).toBe(401)
  })

  it('keeps students out of examiner routes', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/examiner/exams', headers: student })
    expect(res.statusCode).toBe(403)
  })
})

describe('attempts', () => {
  it('starts once and resumes the same attempt with the same key', async () => {
    const first = await start()
    const again = await start()
    expect(again.attemptId).toBe(first.attemptId)
    expect(again.hmacKey).toBe(first.hmacKey)
    expect(first.deadline).toBe(ctx.clock.now + 60 * 60_000)
    expect(first.exam.questions[0]).not.toHaveProperty('correct')
    expect(first.answers).toEqual({})
  })

  it('refuses students who are not enrolled', async () => {
    const outsider = await signIn(ctx.app, 'outsider@test.edu')
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attempts',
      headers: outsider,
      payload: { examId: seeded.exam.id },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('sync', () => {
  it('accepts a sealed chain and projects the latest answer', async () => {
    const session = await start()
    const chain = await clientChain(session)
    const t = ctx.clock.now
    const batch = [
      await chain.next('session.started', {}, t),
      await chain.next('answer', { questionId: seeded.single.id, value: 'b' }, t + 1000),
      await chain.next('answer', { questionId: seeded.single.id, value: 'a' }, t + 2000),
    ]
    expect((await sync(session.attemptId, batch)).ackedSeq).toBe(3)
    const [row] = await ctx.deps.db.select().from(answers).where(eq(answers.attemptId, session.attemptId))
    expect(row).toMatchObject({ value: 'a', seq: 3 })
  })

  it('is idempotent when a lost ack makes the client resend', async () => {
    const session = await start()
    const chain = await clientChain(session)
    const first = await chain.next('session.started', {}, ctx.clock.now)
    await sync(session.attemptId, [first])
    const second = await chain.next('answer', { questionId: seeded.text.id, value: 'hello' }, ctx.clock.now)
    expect((await sync(session.attemptId, [first, second])).ackedSeq).toBe(2)
  })

  it('stops at a gap and continues once the missing event arrives', async () => {
    const session = await start()
    const chain = await clientChain(session)
    const e1 = await chain.next('session.started', {}, ctx.clock.now)
    const e2 = await chain.next('answer', { questionId: seeded.text.id, value: 'x' }, ctx.clock.now)
    const e3 = await chain.next('answer', { questionId: seeded.text.id, value: 'y' }, ctx.clock.now)
    expect((await sync(session.attemptId, [e1, e3])).ackedSeq).toBe(1)
    expect((await sync(session.attemptId, [e2, e3])).ackedSeq).toBe(3)
  })

  it('marks a tampered chain and accepts nothing after it', async () => {
    const session = await start()
    const chain = await clientChain(session)
    const e1 = await chain.next('session.started', {}, ctx.clock.now)
    const e2 = await chain.next('answer', { questionId: seeded.single.id, value: 'b' }, ctx.clock.now)
    const forged = { ...e2, data: { questionId: seeded.single.id, value: 'a' } }
    expect((await sync(session.attemptId, [e1, forged])).ackedSeq).toBe(1)
    const [attempt] = await ctx.deps.db.select().from(attempts).where(eq(attempts.id, session.attemptId))
    expect(attempt!.chainBrokenAt).toBe(2)
    expect((await sync(session.attemptId, [e2])).ackedSeq).toBe(1)
  })

  it('keeps late answers in the chain but does not grade them', async () => {
    const session = await start()
    const chain = await clientChain(session)
    const late = await chain.next(
      'answer',
      { questionId: seeded.text.id, value: 'late' },
      session.deadline + 1,
    )
    expect((await sync(session.attemptId, [late])).ackedSeq).toBe(1)
    expect(await ctx.deps.db.select().from(answers)).toHaveLength(0)
  })

  it('accepts answers written offline before the deadline within the offline window', async () => {
    const session = await start()
    const chain = await clientChain(session)
    const offline = await chain.next(
      'answer',
      { questionId: seeded.text.id, value: 'offline' },
      session.deadline - 1000,
    )
    ctx.clock.now = session.deadline + 5 * 60_000
    await sync(session.attemptId, [offline])
    expect(await ctx.deps.db.select().from(answers)).toHaveLength(1)
  })

  it('handles concurrent requests from one client without corrupting the chain', async () => {
    const session = await start()
    const chain = await clientChain(session)
    const batch = [await chain.next('session.started', {}, ctx.clock.now)]
    for (let i = 0; i < 5; i++)
      batch.push(await chain.next('answer', { questionId: seeded.text.id, value: `v${i}` }, ctx.clock.now))
    const results = await Promise.all([sync(session.attemptId, batch), sync(session.attemptId, batch)])
    expect(results.map((r) => r.ackedSeq)).toEqual([6, 6])
    const stored = await ctx.deps.db.select().from(events).where(eq(events.attemptId, session.attemptId))
    expect(stored).toHaveLength(6)
  })

  it('redelivers a command until the client acknowledges it', async () => {
    const session = await start()
    const examiner = await signIn(ctx.app, 'teacher@test.edu')
    await ctx.app.inject({
      method: 'POST',
      url: `/api/examiner/attempts/${session.attemptId}/commands`,
      headers: examiner,
      payload: { type: 'warn', message: 'Look at the screen' },
    })
    const chain = await clientChain(session)
    const first = await sync(session.attemptId, [])
    expect(first.commands).toHaveLength(1)
    expect((await sync(session.attemptId, [])).commands).toHaveLength(1)
    const ack = await chain.next('command.received', { commandId: first.commands[0]!.id }, ctx.clock.now)
    expect((await sync(session.attemptId, [ack])).commands).toHaveLength(0)
  })
})

describe('event log', () => {
  it('cannot be modified, even directly in the database', async () => {
    const session = await start()
    const chain = await clientChain(session)
    await sync(session.attemptId, [await chain.next('session.started', {}, ctx.clock.now)])
    await expect(ctx.deps.db.execute(sql`update events set type = 'x'`)).rejects.toThrow()
    await expect(ctx.deps.db.execute(sql`delete from events`)).rejects.toThrow()
  })
})
