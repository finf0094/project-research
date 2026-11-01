// Recorded chunks as browsers really send them, and what the examiner is told about the server's check.
import { createHash } from 'node:crypto'
import type { AttemptSession } from '@exam/contracts'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { blobs, chunkObservations } from '../src/db/schema.ts'
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

const WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81])
const MP4 = Buffer.from([0, 0, 0, 0x1c, ...Buffer.from('ftypiso5')])
const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex')

/** A running attempt that announced these chunks in one fragment. */
async function announced(chunks: Buffer[]) {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/attempts',
    headers: student,
    payload: { examId: seeded.exam.id },
  })
  const session: AttemptSession = res.json()
  const chain = await clientChain(session)
  const t = ctx.clock.now
  const hashes = chunks.map(sha)
  const fragment = {
    reason: 'risk',
    tStart: t,
    tEnd: t + 10_000,
    chunks: hashes,
    chunkStarts: hashes.map(() => t),
  }
  await ctx.app.inject({
    method: 'POST',
    url: `/api/attempts/${session.attemptId}/sync`,
    headers: student,
    payload: {
      events: [
        await chain.next('session.started', {}, t),
        await chain.next('evidence.fragment', fragment, t),
      ],
    },
  })
  return session.attemptId
}

const put = (attemptId: string, body: Buffer, type?: string) =>
  ctx.app.inject({
    method: 'PUT',
    url: `/api/attempts/${attemptId}/chunks/${sha(body)}`,
    headers: type === undefined ? student : { ...student, 'content-type': type },
    payload: body,
  })

describe('chunk upload', () => {
  it("accepts Safari's MP4 with codecs, and a chunk whose type the browser left empty", async () => {
    const chunks = [
      Buffer.concat([MP4, Buffer.from('safari')]),
      Buffer.concat([WEBM, Buffer.from('no type')]),
      Buffer.concat([MP4, Buffer.from('no header')]),
      Buffer.concat([WEBM, Buffer.from('generic')]),
    ]
    const attemptId = await announced(chunks)
    expect((await put(attemptId, chunks[0]!, 'video/mp4; codecs="avc1.42000a, mp4a.40.2"')).statusCode).toBe(
      204,
    )
    expect((await put(attemptId, chunks[1]!, '')).statusCode).toBe(204)
    expect((await put(attemptId, chunks[2]!)).statusCode).toBe(204)
    expect((await put(attemptId, chunks[3]!, 'application/octet-stream')).statusCode).toBe(204)

    const stored = await ctx.deps.db.select().from(blobs).where(eq(blobs.attemptId, attemptId))
    const mimeOf = new Map(stored.map((b) => [b.hash, b.mime]))
    expect(chunks.map((c) => mimeOf.get(sha(c)))).toEqual([
      'video/mp4',
      'video/webm',
      'video/mp4',
      'video/webm',
    ])
  })

  it('still refuses a body that is no recording', async () => {
    const text = Buffer.from('just some text')
    const attemptId = await announced([text])
    expect((await put(attemptId, text, '')).statusCode).toBe(415)
    expect((await put(attemptId, text, 'application/octet-stream')).statusCode).toBe(415)
  })
})

describe('empty chunk', () => {
  it('is refused, so an empty file never counts as an uploaded recording', async () => {
    const empty = Buffer.alloc(0)
    const attemptId = await announced([empty])
    for (const type of ['video/mp4', 'video/webm', '', undefined])
      expect((await put(attemptId, empty, type)).statusCode).toBe(400)
    expect(await ctx.deps.db.select().from(blobs).where(eq(blobs.attemptId, attemptId))).toEqual([])
  })
})

describe('server check', () => {
  it('counts a chunk the models could not decode as recorded, not as checked', async () => {
    const chunks = [Buffer.concat([WEBM, Buffer.from('seen')]), Buffer.concat([WEBM, Buffer.from('broken')])]
    const attemptId = await announced(chunks)
    for (const chunk of chunks) expect((await put(attemptId, chunk, 'video/webm')).statusCode).toBe(204)
    const seen = { at: ctx.clock.now, faces: 1, object: false, dark: false, loud: false }
    await ctx.deps.db.insert(chunkObservations).values([
      { attemptId, hash: sha(chunks[0]!), observations: [seen] },
      { attemptId, hash: sha(chunks[1]!), observations: [] },
    ])
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/examiner/attempts/${attemptId}`,
      headers: await signIn(ctx.app, 'teacher@test.edu'),
    })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().serverCheck).toEqual({ recorded: 2, checked: 1 })
  })
})
