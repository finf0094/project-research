// What is kept and for how long: recordings after the retention period, control fragments after finishing.
import type { AttemptSession, SyncResponse } from '@exam/contracts'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { attempts } from '../src/db/schema.ts'
import { analyzeNext } from '../src/jobs/jobs.ts'
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

describe('retention', () => {
  const DAY = 86_400_000

  /** A submitted and analysed attempt with one uploaded chunk; returns its id and the chunk's hash. */
  async function analysedWithChunk() {
    const { createHash } = await import('node:crypto')
    const s = await session()
    const chain = await clientChain(s)
    const chunk = Buffer.from('chunk')
    const hash = createHash('sha256').update(chunk).digest('hex')
    const t = ctx.clock.now
    await sync(s.attemptId, [
      await chain.next(
        'evidence.fragment',
        { reason: 'control', tStart: t, tEnd: t + 1, chunks: [hash], chunkStarts: [t] },
        t,
      ),
    ])
    await ctx.app.inject({
      method: 'PUT',
      url: `/api/attempts/${s.attemptId}/chunks/${hash}`,
      headers: { ...student, 'content-type': 'video/webm' },
      payload: chunk,
    })
    await ctx.app.inject({
      method: 'POST',
      url: `/api/attempts/${s.attemptId}/submit`,
      headers: student,
      payload: { lastSeq: chain.head.seq, lastHash: chain.head.hash },
    })
    await analyzeNext(ctx.deps)
    return { attemptId: s.attemptId, hash }
  }

  async function decide(attemptId: string, verdict: string) {
    await ctx.app.inject({
      method: 'PUT',
      url: `/api/examiner/attempts/${attemptId}/decision`,
      headers: await examiner(),
      payload: { verdict, comment: '', score: 80 },
    })
  }

  it('deletes recordings of decided attempts after the retention period and keeps the log', async () => {
    const { blobs, events } = await import('../src/db/schema.ts')
    const { removeExpiredRecordings } = await import('../src/jobs/jobs.ts')
    const { attemptId, hash } = await analysedWithChunk()
    await decide(attemptId, 'clean')

    expect(await removeExpiredRecordings(ctx.deps)).toBe(0)
    ctx.clock.now += 31 * DAY
    expect(await removeExpiredRecordings(ctx.deps)).toBe(1)
    expect(await ctx.deps.db.select().from(blobs)).toHaveLength(0)
    expect(await ctx.deps.storage.get(`${attemptId}/${hash}`)).toBeNull()
    expect(await ctx.deps.db.select().from(events)).toHaveLength(1)
  })

  it('keeps the recordings of an attempt still waiting for a decision, however long', async () => {
    const { removeExpiredRecordings } = await import('../src/jobs/jobs.ts')
    const { attemptId } = await analysedWithChunk()
    const [row] = await ctx.deps.db.select().from(attempts).where(eq(attempts.id, attemptId))
    expect(row!.status).toBe('ready_for_review')
    ctx.clock.now += 90 * DAY
    expect(await removeExpiredRecordings(ctx.deps)).toBe(0)
  })

  it('counts the period from the latest decision', async () => {
    const { removeExpiredRecordings } = await import('../src/jobs/jobs.ts')
    const { attemptId } = await analysedWithChunk()
    await decide(attemptId, 'clean')
    ctx.clock.now += 20 * DAY
    await decide(attemptId, 'violation') // reconsidered: the period starts again
    ctx.clock.now += 20 * DAY
    expect(await removeExpiredRecordings(ctx.deps)).toBe(0)
    ctx.clock.now += 11 * DAY
    expect(await removeExpiredRecordings(ctx.deps)).toBe(1)
  })

  it('keeps the recordings of an attempt that is still running', async () => {
    const { removeExpiredRecordings } = await import('../src/jobs/jobs.ts')
    const { blobs } = await import('../src/db/schema.ts')
    const s = await session()
    await ctx.deps.db.insert(blobs).values({ attemptId: s.attemptId, hash: 'h', mime: 'video/webm', size: 1 })
    ctx.clock.now += 31 * DAY
    expect(await removeExpiredRecordings(ctx.deps)).toBe(0)
  })
})

describe('control fragments after finishing', () => {
  it('stops asking for control fragments once the student has finished', async () => {
    const s = await session()
    const chain = await clientChain(s)
    ctx.clock.now += 13 * 60_000
    const res: SyncResponse = (
      await sync(s.attemptId, [await chain.next('session.submitted', {}, ctx.clock.now)])
    ).json()
    expect(res.commands).toEqual([])
    const [row] = await ctx.deps.db.select().from(attempts).where(eq(attempts.id, s.attemptId))
    expect(row!.nextCaptureAt).toBeNull()
  })
})
