import { createHash } from 'node:crypto'
import type { AttemptSession } from '@exam/contracts'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { attempts, examParticipants, markers } from '../src/db/schema.ts'
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

  it('puts no marker for a signal switched off for this student', async () => {
    await ctx.deps.db
      .update(examParticipants)
      .set({ disabledSignals: ['face_missing'] })
      .where(eq(examParticipants.examId, seeded.exam.id))
    const { session, chain } = await startedChain()
    await sync(session.attemptId, [
      await chain.next('session.started', {}, ctx.clock.now),
      await chain.next('proctor.signal', { kind: 'face_missing', active: true }, ctx.clock.now),
    ])
    ctx.clock.now += 3_000
    expect(await analyzeLiveNext(ctx.deps)).toBe(true)
    expect(await markersOf(session.attemptId)).toEqual([])
  })

  it('never lets an older rebuild overwrite markers built from a newer log', async () => {
    const { session, chain } = await startedChain()
    await sync(session.attemptId, [
      await chain.next('session.started', {}, ctx.clock.now),
      await chain.next('proctor.signal', { kind: 'face_missing', active: true }, ctx.clock.now),
    ])
    // Another worker already wrote markers from a later event.
    await ctx.deps.db.update(attempts).set({ liveSeq: 99 }).where(eq(attempts.id, session.attemptId))
    ctx.clock.now += 3_000
    expect(await analyzeLiveNext(ctx.deps)).toBe(true)
    expect(await markersOf(session.attemptId)).toEqual([])
  })

  it('is due again when a recording of the running exam arrives', async () => {
    const { session, chain } = await startedChain()
    const chunk = Buffer.from('a recorded chunk')
    const hash = createHash('sha256').update(chunk).digest('hex')
    const t = ctx.clock.now
    await sync(session.attemptId, [
      await chain.next('session.started', {}, t),
      await chain.next(
        'evidence.fragment',
        { reason: 'risk', tStart: t, tEnd: t + 10_000, chunks: [hash], chunkStarts: [t] },
        t,
      ),
    ])
    ctx.clock.now += 3_000
    expect(await analyzeLiveNext(ctx.deps)).toBe(true) // the announcement
    const put = await ctx.app.inject({
      method: 'PUT',
      url: `/api/attempts/${session.attemptId}/chunks/${hash}`,
      headers: { ...student, 'content-type': 'video/webm' },
      payload: chunk,
    })
    expect(put.statusCode).toBe(204)
    ctx.clock.now += 3_000
    expect(await analyzeLiveNext(ctx.deps)).toBe(true) // the upload: its models run now
  })
})
