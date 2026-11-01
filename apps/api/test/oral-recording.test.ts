import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import type { AttemptDetail, AttemptSession } from '@exam/contracts'
import { AccessToken } from 'livekit-server-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { analyzeNext, mergeNextAudio } from '../src/jobs/jobs.ts'
import { decodeAudio } from '../src/media/audio.ts'
import { clientChain, createTestContext, seedExam, signIn, type TestContext } from './helpers.ts'

let ctx: TestContext
let seeded: Awaited<ReturnType<typeof seedExam>>
let student: { cookie: string }
let examiner: { cookie: string }
const KEY = 'key'
const SECRET = 'a-secret-long-enough-for-hmac-signing-0123'

beforeEach(async () => {
  ctx = await createTestContext()
  ctx.deps.config = { ...ctx.deps.config, LIVEKIT_API_KEY: KEY, LIVEKIT_API_SECRET: SECRET }
  seeded = await seedExam(ctx, { mode: 'oral', recording: 'full', ticketSize: 1 })
  student = await signIn(ctx.app, 'student@test.edu')
  examiner = await signIn(ctx.app, 'teacher@test.edu')
})
afterEach(() => ctx.close())

async function start(): Promise<AttemptSession> {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/attempts',
    headers: student,
    payload: { examId: seeded.exam.id },
  })
  return res.json()
}

const detail = async (attemptId: string): Promise<AttemptDetail> =>
  (
    await ctx.app.inject({ method: 'GET', url: `/api/examiner/attempts/${attemptId}`, headers: examiner })
  ).json()

/** A webhook as LiveKit sends it: the body, and a JWT signed with the API secret covering the body's hash. */
async function webhook(body: object, secret = SECRET) {
  const text = JSON.stringify(body)
  const token = new AccessToken(KEY, secret)
  token.sha256 = createHash('sha256').update(text).digest('base64')
  return ctx.app.inject({
    method: 'POST',
    url: '/api/livekit/webhook',
    headers: { 'content-type': 'application/webhook+json', authorization: await token.toJwt() },
    payload: text,
  })
}

const callEvent = (id: string, event: string, attemptId: string, identity: string, seconds: number) => ({
  id,
  event,
  createdAt: String(seconds),
  room: { name: `attempt-${attemptId}` },
  participant: { identity },
})

describe('call webhooks', () => {
  it('record joins and leaves of the call once, and only when signed', async () => {
    const { attemptId } = await start()
    const t = Math.floor(ctx.clock.now / 1000)
    expect(
      (await webhook(callEvent('EV1', 'participant_joined', attemptId, 'student:x', t), 'wrong')).statusCode,
    ).toBe(401)

    await webhook(callEvent('EV1', 'participant_joined', attemptId, 'student:x', t))
    await webhook(callEvent('EV1', 'participant_joined', attemptId, 'student:x', t)) // redelivered
    await webhook(callEvent('EV2', 'participant_left', attemptId, 'student:x', t + 30))
    await webhook(callEvent('EV3', 'participant_joined', attemptId, 'examiner:y', t + 5))
    await webhook(callEvent('EV4', 'room_finished', attemptId, 'student:x', t + 60)) // not a call event
    await webhook(
      callEvent('EV5', 'participant_joined', '00000000-0000-0000-0000-000000000000', 'student:x', t),
    )

    expect((await detail(attemptId)).call).toEqual([
      { who: 'student', kind: 'joined', at: t * 1000 },
      { who: 'examiner', kind: 'joined', at: (t + 5) * 1000 },
      { who: 'student', kind: 'left', at: (t + 30) * 1000 },
    ])
  })
})

/** A short WebM chunk with a tone, as a browser's MediaRecorder would produce (audio only is enough here). */
const toneChunk = (hz: number) =>
  execFileSync('ffmpeg', [
    ...['-loglevel', 'error', '-f', 'lavfi', '-i', `sine=frequency=${hz}:duration=1`],
    ...['-c:a', 'libopus', '-f', 'webm', 'pipe:1'],
  ])

describe('merge-audio', () => {
  it('joins the recorded chunks of an oral answer into one audio file', async () => {
    const session = await start()
    const chain = await clientChain(session)
    const t = ctx.clock.now
    const chunks = [toneChunk(440), toneChunk(880)]
    const hashes = chunks.map((c) => createHash('sha256').update(c).digest('hex'))
    const events = [
      await chain.next('session.started', {}, t),
      // Announced in reverse: the merge follows the recording's start times, not the order of events.
      await chain.next(
        'evidence.fragment',
        { reason: 'full', tStart: t + 3000, tEnd: t + 4000, chunks: [hashes[1]], chunkStarts: [t + 3000] },
        t + 2000,
      ),
      await chain.next(
        'evidence.fragment',
        { reason: 'full', tStart: t, tEnd: t + 1000, chunks: [hashes[0]], chunkStarts: [t] },
        t + 2000,
      ),
    ]
    const sync = await ctx.app.inject({
      method: 'POST',
      url: `/api/attempts/${session.attemptId}/sync`,
      headers: student,
      payload: { events },
    })
    expect(sync.statusCode, sync.body).toBe(200)
    for (const [i, chunk] of chunks.entries()) {
      const put = await ctx.app.inject({
        method: 'PUT',
        url: `/api/attempts/${session.attemptId}/chunks/${hashes[i]}`,
        headers: { ...student, 'content-type': 'video/webm' },
        payload: chunk,
      })
      expect(put.statusCode).toBe(204)
    }
    await ctx.app.inject({
      method: 'POST',
      url: `/api/attempts/${session.attemptId}/submit`,
      headers: student,
      payload: { lastSeq: chain.head.seq, lastHash: chain.head.hash },
    })

    expect(await mergeNextAudio(ctx.deps)).toBe(false) // not analysed yet: uploads may still be coming
    expect(await analyzeNext(ctx.deps)).toBe(true)
    expect(await mergeNextAudio(ctx.deps)).toBe(true)
    expect(await mergeNextAudio(ctx.deps)).toBe(false) // done once

    const { audio } = await detail(session.attemptId)
    expect(audio).toMatchObject({ state: 'ready', hash: expect.stringMatching(/^[0-9a-f]{64}$/) })
    const url = `/api/examiner/attempts/${session.attemptId}/chunks/${audio!.hash}`
    const file = await ctx.app.inject({ method: 'GET', url, headers: examiner })
    // The player seeks with ranges.
    const part = await ctx.app.inject({ method: 'GET', url, headers: { ...examiner, range: 'bytes=0-99' } })
    expect(part.statusCode).toBe(206)
    expect(part.rawPayload.equals(file.rawPayload.subarray(0, 100))).toBe(true)
    // 1 s of tone, the 2 s gap kept as silence, 1 s of tone (measured on the decoded sound, 16 kHz 16-bit).
    const seconds = (await decodeAudio(file.rawPayload))!.length / 32_000
    expect(seconds).toBeGreaterThan(3.8)
    expect(seconds).toBeLessThan(4.3)
  })
})
