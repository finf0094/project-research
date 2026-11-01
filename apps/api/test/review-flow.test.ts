// The way from a submitted attempt to the examiner: uploads, analysis, markers, decision; and resuming.
import { createHash } from 'node:crypto'
import type { AttemptSession, SyncResponse } from '@exam/contracts'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

describe('submit, recording and review', () => {
  it('refuses to submit before every event is synced', async () => {
    const session = await start()
    const chain = await clientChain(session)
    await chain.next('session.started', {}, ctx.clock.now)
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/attempts/${session.attemptId}/submit`,
      headers: student,
      payload: { lastSeq: chain.head.seq, lastHash: chain.head.hash },
    })
    expect(res.statusCode).toBe(409)
  })

  it('runs the full path: fragment upload, analysis, markers and decision', async () => {
    const session = await start()
    const chain = await clientChain(session)
    const t = ctx.clock.now
    const chunk = Buffer.from('fake webm chunk')
    const chunkHash = createHash('sha256').update(chunk).digest('hex')
    await sync(session.attemptId, [
      await chain.next('session.started', {}, t),
      await chain.next('proctor.signal', { kind: 'multiple_faces', active: true }, t + 10_000),
      await chain.next(
        'evidence.fragment',
        { reason: 'risk', tStart: t, tEnd: t + 20_000, chunks: [chunkHash], chunkStarts: [t] },
        t + 20_000,
      ),
      await chain.next('proctor.signal', { kind: 'multiple_faces', active: false }, t + 40_000),
      await chain.next('answer', { questionId: seeded.single.id, value: 'a' }, t + 50_000),
    ])

    const put = (hash: string, body: Buffer) =>
      ctx.app.inject({
        method: 'PUT',
        url: `/api/attempts/${session.attemptId}/chunks/${hash}`,
        headers: { ...student, 'content-type': 'video/webm' },
        payload: body,
      })
    expect((await put(chunkHash, Buffer.from('other bytes'))).statusCode).toBe(400)
    const unknown = Buffer.from('not announced')
    expect((await put(createHash('sha256').update(unknown).digest('hex'), unknown)).statusCode).toBe(404)

    const submit = await ctx.app.inject({
      method: 'POST',
      url: `/api/attempts/${session.attemptId}/submit`,
      headers: student,
      payload: { lastSeq: chain.head.seq, lastHash: chain.head.hash },
    })
    expect(submit.json()).toEqual({ status: 'submitted' })
    expect(await analyzeNext(ctx.deps)).toBe(false) // waits for the announced chunk
    expect((await put(chunkHash, chunk)).statusCode).toBe(204)
    expect(await analyzeNext(ctx.deps)).toBe(true)

    const examiner = await signIn(ctx.app, 'teacher@test.edu')
    const detail = (
      await ctx.app.inject({
        method: 'GET',
        url: `/api/examiner/attempts/${session.attemptId}`,
        headers: examiner,
      })
    ).json()
    expect(detail.summary).toMatchObject({ status: 'ready_for_review', answered: 1, markerCount: 1 })
    expect(detail.answers[0]).toMatchObject({ value: 'a', autoScore: 2 })
    // The models ran, but the fake chunk does not decode: the reviewer is told it was not checked.
    expect(detail.serverAnalysis).toBe('partial')
    expect(detail.markers).toEqual([
      expect.objectContaining({ kind: 'multiple_faces', status: 'pending', chunks: [chunkHash] }),
    ])

    const video = await ctx.app.inject({
      method: 'GET',
      url: `/api/examiner/attempts/${session.attemptId}/chunks/${chunkHash}`,
      headers: examiner,
    })
    expect(video.rawPayload.equals(chunk)).toBe(true)

    const marker = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/examiner/markers/${detail.markers[0].id}`,
      headers: examiner,
      payload: { status: 'dismissed' },
    })
    expect(marker.statusCode).toBe(204)
    // A judgement can be taken back.
    const undo = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/examiner/markers/${detail.markers[0].id}`,
      headers: examiner,
      payload: { status: 'pending' },
    })
    expect(undo.statusCode).toBe(204)
    const decision = await ctx.app.inject({
      method: 'PUT',
      url: `/api/examiner/attempts/${session.attemptId}/decision`,
      headers: examiner,
      payload: { verdict: 'clean', comment: 'Second person was a family member passing by.', score: 70 },
    })
    expect(decision.statusCode).toBe(204)
  })

  it('closes attempts that were never submitted after the offline window', async () => {
    const session = await start()
    ctx.clock.now = session.deadline + 16 * 60_000
    expect(await closeExpired(ctx.deps)).toBe(1)
  })
})

describe('resume on another device', () => {
  it('returns the answers the server already holds', async () => {
    const session = await start()
    const chain = await clientChain(session)
    await sync(session.attemptId, [
      await chain.next('answer', { questionId: seeded.single.id, value: 'b' }, ctx.clock.now),
    ])
    const again = await start()
    expect(again.answers).toEqual({ [seeded.single.id]: 'b' })
    expect(again.ackedSeq).toBe(1)
  })
})
