import type { AttemptSummary, ExaminerExam } from '@exam/contracts'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { answers, attempts, markers } from '../src/db/schema.ts'
import { createTestContext, seedExam, signIn, type TestContext } from './helpers.ts'

let ctx: TestContext
let seeded: Awaited<ReturnType<typeof seedExam>>
let examiner: { cookie: string }

beforeEach(async () => {
  ctx = await createTestContext()
  seeded = await seedExam(ctx)
  examiner = await signIn(ctx.app, 'teacher@test.edu')
})
afterEach(() => ctx.close())

const get = async <T>(url: string): Promise<T> =>
  (await ctx.app.inject({ method: 'GET', url: `/api${url}`, headers: examiner })).json()

/** A student's attempt with a correct choice answer and two markers, ready for review. */
async function reviewableAttempt() {
  const student = await signIn(ctx.app, 'student@test.edu')
  const start = await ctx.app.inject({
    method: 'POST',
    url: '/api/attempts',
    headers: student,
    payload: { examId: seeded.exam.id },
  })
  const { attemptId } = start.json()
  await ctx.deps.db.insert(answers).values({
    attemptId,
    questionId: seeded.single.id,
    value: 'a',
    seq: 1,
  })
  const marker = { attemptId, startAt: 0, endAt: 1000, status: 'pending' as const, chunks: [] }
  await ctx.deps.db.insert(markers).values([
    { ...marker, kind: 'tab_hidden' },
    { ...marker, kind: 'tab_hidden' },
    { ...marker, kind: 'noise' },
  ])
  await ctx.deps.db.update(attempts).set({ status: 'ready_for_review' }).where(eq(attempts.id, attemptId))
  return attemptId as string
}

describe('examiner views', () => {
  it('summarises the exam: questions by type, points and participants', async () => {
    const exam = await get<ExaminerExam>(`/examiner/exams/${seeded.exam.id}`)
    expect(exam).toMatchObject({
      durationMin: 60,
      questions: { single: 1, multiple: 0, text: 1, points: 7 },
      participants: 1,
      publishedAt: null,
    })
  })

  it('lists attempts with automatic points, main markers and the result once decided', async () => {
    const attemptId = await reviewableAttempt()
    const [before] = await get<AttemptSummary[]>(`/examiner/exams/${seeded.exam.id}/attempts`)
    expect(before).toMatchObject({
      points: { auto: 2, max: 7, open: true },
      topMarkers: [
        { kind: 'tab_hidden', count: 2 },
        { kind: 'noise', count: 1 },
      ],
      markerCount: 3,
      result: null,
    })

    const decide = (verdict: string, score: number | null) =>
      ctx.app.inject({
        method: 'PUT',
        url: `/api/examiner/attempts/${attemptId}/decision`,
        headers: examiner,
        payload: { verdict, comment: '', score },
      })
    // Accepting work with an open answer needs the examiner's score.
    expect((await decide('clean', null)).statusCode).toBe(400)
    await decide('needs_review', null)
    expect((await get<AttemptSummary[]>(`/examiner/exams/${seeded.exam.id}/attempts`))[0]!.result).toEqual({
      verdict: 'needs_review',
      score: null,
    })
    ctx.clock.now += 60_000 // a later decision replaces the earlier one
    await decide('clean', 80)
    expect(
      (await get<AttemptSummary[]>(`/examiner/exams/${seeded.exam.id}/attempts`))[0]!.result!.score,
    ).toBe(80)
  })

  it('publishes results for students', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/examiner/exams/${seeded.exam.id}/publish`,
      headers: examiner,
    })
    expect(res.statusCode).toBe(204)
    expect((await get<ExaminerExam>(`/examiner/exams/${seeded.exam.id}`)).publishedAt).toBe(ctx.clock.now)
  })
})
