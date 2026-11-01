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
  it('deletes recordings of decided attempts after the retention period and keeps the log', async () => {
    const { createHash } = await import('node:crypto')
    const { blobs, events } = await import('../src/db/schema.ts')
    const { removeExpiredRecordings } = await import('../src/jobs/jobs.ts')
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
    const headers = await examiner()
    await ctx.app.inject({
      method: 'PUT',
      url: `/api/examiner/attempts/${s.attemptId}/decision`,
      headers,
      payload: { verdict: 'clean', comment: '', score: 80 },
    })

    expect(await removeExpiredRecordings(ctx.deps)).toBe(0)
    ctx.clock.now += 31 * 86_400_000
    expect(await removeExpiredRecordings(ctx.deps)).toBe(1)
    expect(await ctx.deps.db.select().from(blobs)).toHaveLength(0)
    expect(await ctx.deps.storage.get(`${s.attemptId}/${hash}`)).toBeNull()
    expect(await ctx.deps.db.select().from(events)).toHaveLength(1)
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
