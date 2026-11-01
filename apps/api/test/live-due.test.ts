// What makes a running attempt's live markers due, and what keeps it due.
import { createHash } from 'node:crypto'
import type { AttemptSession } from '@exam/contracts'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attempts, markers } from '../src/db/schema.ts'
import { analyzeLiveNext } from '../src/jobs/jobs.ts'
import { clientChain, createTestContext, seedExam, signIn, type TestContext } from './helpers.ts'

// A worker without the model files (REQUIRE_MODELS off).
vi.mock('../src/ml/recordings.ts', async (original) => ({
  ...(await original<typeof import('../src/ml/recordings.ts')>()),
  loadModels: async () => null,
}))

let ctx: TestContext
let seeded: Awaited<ReturnType<typeof seedExam>>
let student: { cookie: string }

beforeEach(async () => {
  ctx = await createTestContext()
  seeded = await seedExam(ctx)
  student = await signIn(ctx.app, 'student@test.edu')
})
afterEach(() => ctx.close())

async function started() {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/attempts',
    headers: student,
    payload: { examId: seeded.exam.id },
  })
  const session: AttemptSession = res.json()
  return { attemptId: session.attemptId, chain: await clientChain(session) }
}

const sync = (attemptId: string, events: unknown[]) =>
  ctx.app.inject({
    method: 'POST',
    url: `/api/attempts/${attemptId}/sync`,
    headers: student,
    payload: { events },
  })

const kindsOf = async (attemptId: string) =>
  (await ctx.deps.db.select().from(markers).where(eq(markers.attemptId, attemptId))).map((m) => m.kind)

describe('live markers are due', () => {
  it('after a reload, so the closed page shows while the exam runs', async () => {
    const { attemptId, chain } = await started()
    const t = ctx.clock.now
    await sync(attemptId, [
      await chain.next('session.started', {}, t),
      await chain.next('session.resumed', {}, t + 60_000),
    ])
    ctx.clock.now += 63_000
    expect(await analyzeLiveNext(ctx.deps)).toBe(true)
    expect(await kindsOf(attemptId)).toEqual(['page_closed'])
  })

  it('after a broken chain, though no event is accepted with it', async () => {
    const { attemptId, chain } = await started()
    const e1 = await chain.next('session.started', {}, ctx.clock.now)
    const e2 = await chain.next('proctor.signal', { kind: 'paste', active: true }, ctx.clock.now)
    await sync(attemptId, [e1, { ...e2, data: { kind: 'copy', active: true } }])
    ctx.clock.now += 3_000
    expect(await analyzeLiveNext(ctx.deps)).toBe(true)
    expect(await kindsOf(attemptId)).toEqual(['chain_broken'])
  })

  it('not again and again for chunks no model can look at', async () => {
    const { attemptId, chain } = await started()
    const t = ctx.clock.now
    const chunks = Array.from({ length: 7 }, (_, i) => Buffer.from([0x1a, 0x45, 0xdf, 0xa3, i]))
    const hashes = chunks.map((c) => createHash('sha256').update(c).digest('hex'))
    await sync(attemptId, [
      await chain.next('session.started', {}, t),
      await chain.next(
        'evidence.fragment',
        { reason: 'risk', tStart: t, tEnd: t + 70_000, chunks: hashes, chunkStarts: hashes.map(() => t) },
        t,
      ),
    ])
    for (const [i, chunk] of chunks.entries()) {
      const put = await ctx.app.inject({
        method: 'PUT',
        url: `/api/attempts/${attemptId}/chunks/${hashes[i]}`,
        headers: { ...student, 'content-type': 'video/webm' },
        payload: chunk,
      })
      expect(put.statusCode).toBe(204)
    }
    ctx.clock.now += 3_000
    expect(await analyzeLiveNext(ctx.deps)).toBe(true)
    const [row] = await ctx.deps.db.select().from(attempts).where(eq(attempts.id, attemptId))
    expect(row!.liveDueAt).toBeNull()
  })
})
