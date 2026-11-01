import type { AttemptSession } from '@exam/contracts'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { attempts, markers } from '../src/db/schema.ts'
import { analyzeLiveNext } from '../src/jobs/jobs.ts'
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

async function startedChain() {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/attempts',
    headers: student,
    payload: { examId: seeded.exam.id },
  })
  const session: AttemptSession = res.json()
  return { session, chain: await clientChain(session) }
}

const sync = (attemptId: string, events: unknown[]) =>
  ctx.app.inject({
    method: 'POST',
    url: `/api/attempts/${attemptId}/sync`,
    headers: student,
    payload: { events },
  })

const markersOf = (attemptId: string) =>
  ctx.deps.db.select().from(markers).where(eq(markers.attemptId, attemptId))

describe('live analysis', () => {
  it('turns a signal into a marker while the exam is still running', async () => {
    const { session, chain } = await startedChain()
    const t = ctx.clock.now
    await sync(session.attemptId, [
      await chain.next('session.started', {}, t),
      await chain.next('proctor.signal', { kind: 'face_missing', active: true }, t + 5_000),
    ])
    expect(await analyzeLiveNext(ctx.deps)).toBe(false) // a burst settles first
    ctx.clock.now += 3_000
    expect(await analyzeLiveNext(ctx.deps)).toBe(true)
    expect(await analyzeLiveNext(ctx.deps)).toBe(false) // done until something new arrives

    const live = await markersOf(session.attemptId)
    expect(live).toEqual([expect.objectContaining({ kind: 'face_missing', status: 'pending' })])
    const [row] = await ctx.deps.db.select().from(attempts).where(eq(attempts.id, session.attemptId))
    expect(row!.status).toBe('active')
    expect(row!.riskScore).toBeGreaterThan(0)
  })

  it('leaves answers alone and is not due for other events', async () => {
    const { session, chain } = await startedChain()
    await sync(session.attemptId, [
      await chain.next('session.started', {}, ctx.clock.now),
      await chain.next('answer', { questionId: seeded.single.id, value: 'a' }, ctx.clock.now),
    ])
    ctx.clock.now += 3_000
    expect(await analyzeLiveNext(ctx.deps)).toBe(false)
    expect(await markersOf(session.attemptId)).toEqual([])
  })
})
