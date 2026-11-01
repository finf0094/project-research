import type { AttemptSession, SyncResponse } from '@exam/contracts'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { answers, attempts } from '../src/db/schema.ts'
import { analyzeNext, closeExpired } from '../src/jobs/jobs.ts'
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

const start = async (headers = student) =>
  ctx.app.inject({ method: 'POST', url: '/api/attempts', headers, payload: { examId: seeded.exam.id } })

async function session(): Promise<AttemptSession> {
  return (await start()).json()
}

async function sync(attemptId: string, events: unknown[]) {
  return ctx.app.inject({
    method: 'POST',
    url: `/api/attempts/${attemptId}/sync`,
    headers: student,
    payload: { events },
  })
}

const examiner = () => signIn(ctx.app, 'teacher@test.edu')

describe('robustness', () => {
  it('turns parallel starts into one attempt instead of a server error', async () => {
    const results = await Promise.all([start(), start(), start()])
    expect(results.map((r) => r.statusCode)).toEqual([200, 200, 200])
    expect(new Set(results.map((r) => r.json().attemptId)).size).toBe(1)
  })

  it('rejects text that would poison the batch with 400, not a permanent 500', async () => {
    const s = await session()
    const chain = await clientChain(s)
    const res = await sync(s.attemptId, [
      await chain.next('answer', { questionId: seeded.text.id, value: 'a\u0000b' }, ctx.clock.now),
    ])
    expect(res.statusCode).toBe(400)
  })

  it('never returns SQL or internal details in error responses', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/attempts/not-a-uuid', headers: student })
    expect(res.statusCode).toBe(400)
    expect(res.body).not.toMatch(/select|hmac/i)
  })

  it('lets a student submit after a chain break and tells the client about it', async () => {
    const s = await session()
    const chain = await clientChain(s)
    const e1 = await chain.next('session.started', {}, ctx.clock.now)
    const e2 = await chain.next('answer', { questionId: seeded.text.id, value: 'x' }, ctx.clock.now)
    const res: SyncResponse = (
      await sync(s.attemptId, [e1, { ...e2, data: { questionId: seeded.text.id, value: 'y' } }])
    ).json()
    expect(res).toMatchObject({ ackedSeq: 1, chainBroken: true })
    const submit = await ctx.app.inject({
      method: 'POST',
      url: `/api/attempts/${s.attemptId}/submit`,
      headers: student,
      payload: { lastSeq: chain.head.seq, lastHash: chain.head.hash },
    })
    expect(submit.json()).toEqual({ status: 'submitted' })
  })
})

describe('access control', () => {
  it('hides another student’s attempt', async () => {
    const s = await session()
    const outsider = await signIn(ctx.app, 'outsider@test.edu')
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/attempts/${s.attemptId}`,
      headers: outsider,
    })
    expect(res.statusCode).toBe(404)
  })

  it('hides attempts of exams owned by another examiner', async () => {
    const s = await session()
    await ctx.deps.db.update(attempts).set({ status: 'ready_for_review' }).where(eq(attempts.id, s.attemptId))
    const { users } = await import('../src/db/schema.ts')
    const { hashPassword } = await import('../src/modules/auth/service.ts')
    await ctx.deps.db.insert(users).values({
      email: 'other@test.edu',
      name: 'Other',
      role: 'examiner',
      passwordHash: await hashPassword('secret-pass'),
    })
    const other = await signIn(ctx.app, 'other@test.edu')
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/examiner/attempts/${s.attemptId}`,
      headers: other,
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('examiner commands and grading', () => {
  it('counts an answer rejected live once the examiner extends the deadline', async () => {
    const s = await session()
    const chain = await clientChain(s)
    const late = await chain.next('answer', { questionId: seeded.single.id, value: 'a' }, s.deadline + 60_000)
    await sync(s.attemptId, [late])
    expect(await ctx.deps.db.select().from(answers)).toHaveLength(0)

    const headers = await examiner()
    const extend = await ctx.app.inject({
      method: 'POST',
      url: `/api/examiner/attempts/${s.attemptId}/commands`,
      headers,
      payload: { type: 'extend', minutes: 10 },
    })
    expect(extend.statusCode).toBe(204)
    await ctx.app.inject({
      method: 'POST',
      url: `/api/attempts/${s.attemptId}/submit`,
      headers: student,
      payload: { lastSeq: chain.head.seq, lastHash: chain.head.hash },
    })
    expect(await analyzeNext(ctx.deps)).toBe(true)
    expect(await ctx.deps.db.select().from(answers)).toHaveLength(1)
  })

  it('leaves an attempt another worker is analyzing alone until its claim expires', async () => {
    const s = await session()
    const chain = await clientChain(s)
    await sync(s.attemptId, [await chain.next('session.started', {}, ctx.clock.now)])
    await ctx.app.inject({
      method: 'POST',
      url: `/api/attempts/${s.attemptId}/submit`,
      headers: student,
      payload: { lastSeq: chain.head.seq, lastHash: chain.head.hash },
    })
    await ctx.deps.db
      .update(attempts)
      .set({ analysisClaimedAt: new Date(ctx.clock.now) })
      .where(eq(attempts.id, s.attemptId))
    expect(await analyzeNext(ctx.deps)).toBe(false)
    ctx.clock.now += 16 * 60_000 // that worker died
    expect(await analyzeNext(ctx.deps)).toBe(true)
  })

  it('terminates an attempt: status reaches the client and later answers do not count', async () => {
    const s = await session()
    const headers = await examiner()
    await ctx.app.inject({
      method: 'POST',
      url: `/api/examiner/attempts/${s.attemptId}/commands`,
      headers,
      payload: { type: 'terminate' },
    })
    ctx.clock.now += 1000
    const chain = await clientChain(s)
    const res: SyncResponse = (
      await sync(s.attemptId, [
        await chain.next('answer', { questionId: seeded.text.id, value: 'after' }, ctx.clock.now),
      ])
    ).json()
    expect(res.status).toBe('terminated')
    expect(await ctx.deps.db.select().from(answers)).toHaveLength(0)
  })

  it('asks for a control fragment at the scheduled moment, once', async () => {
    const s = await session()
    ctx.clock.now += 13 * 60_000
    const first: SyncResponse = (await sync(s.attemptId, [])).json()
    expect(first.commands).toEqual([expect.objectContaining({ type: 'capture', seconds: 20 })])
    const [row] = await ctx.deps.db.select().from(attempts).where(eq(attempts.id, s.attemptId))
    expect(row!.nextCaptureAt!.getTime()).toBeGreaterThan(ctx.clock.now)
  })

  it('accepts nothing after the attempt was closed for being late', async () => {
    const s = await session()
    ctx.clock.now = s.deadline + 16 * 60_000
    await closeExpired(ctx.deps)
    const chain = await clientChain(s)
    const res: SyncResponse = (
      await sync(s.attemptId, [await chain.next('session.started', {}, ctx.clock.now)])
    ).json()
    expect(res).toMatchObject({ ackedSeq: 0, status: 'submitted', commands: [] })
  })
})
