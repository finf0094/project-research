import type { AddressInfo } from 'node:net'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { attempts } from '../src/db/schema.ts'
import { createTestContext, seedExam, signIn, type TestContext } from './helpers.ts'

let ctx: TestContext
let seeded: Awaited<ReturnType<typeof seedExam>>

beforeEach(async () => {
  ctx = await createTestContext()
  seeded = await seedExam(ctx)
})
afterEach(() => ctx.close())

/** Reads the event stream until `count` events named `event` arrived. */
async function readEvents(body: ReadableStream<Uint8Array>, event: string, count: number) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader()
  let text = ''
  while (text.split(`event: ${event}`).length - 1 < count) {
    const { value, done } = await reader.read()
    if (done) break
    text += value
  }
  await reader.cancel()
  return text
}

describe('live monitoring stream', () => {
  it('announces attempt changes to the exam owner, whichever process made them', async () => {
    await ctx.app.listen({ port: 0, host: '127.0.0.1' })
    const { port } = ctx.app.server.address() as AddressInfo
    const examiner = await signIn(ctx.app, 'teacher@test.edu')
    const student = await signIn(ctx.app, 'student@test.edu')

    const stream = await fetch(`http://127.0.0.1:${port}/api/examiner/exams/${seeded.exam.id}/stream`, {
      headers: examiner,
    })
    expect(stream.headers.get('content-type')).toBe('text/event-stream')
    const events = readEvents(stream.body!, 'attempt', 2)

    // The student starts (insert) and the worker-like code ends the attempt (update): two events.
    const start = await ctx.app.inject({
      method: 'POST',
      url: '/api/attempts',
      headers: student,
      payload: { examId: seeded.exam.id },
    })
    const { attemptId } = start.json()
    await ctx.deps.db.update(attempts).set({ status: 'terminated' }).where(eq(attempts.id, attemptId))

    const text = await events
    expect(text.match(/event: attempt/g)).toHaveLength(2)
    expect(text).toContain(`"attemptId":"${attemptId}"`)
  })

  it('is only for the exam owner', async () => {
    const student = await signIn(ctx.app, 'student@test.edu')
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/examiner/exams/${seeded.exam.id}/stream`,
      headers: student,
    })
    expect(res.statusCode).toBe(403)
  })
})
