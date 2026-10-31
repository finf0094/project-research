import type { StudentExamListItem, StudentResult } from '@exam/contracts'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { answers, attempts } from '../src/db/schema.ts'
import { createTestContext, seedExam, signIn, type TestContext } from './helpers.ts'

let ctx: TestContext
let seeded: Awaited<ReturnType<typeof seedExam>>
let student: { cookie: string }
let examiner: { cookie: string }

beforeEach(async () => {
  ctx = await createTestContext()
  seeded = await seedExam(ctx)
  student = await signIn(ctx.app, 'student@test.edu')
  examiner = await signIn(ctx.app, 'teacher@test.edu')
})
afterEach(() => ctx.close())

const call = (method: 'GET' | 'POST' | 'PUT', url: string, headers: { cookie: string }, payload?: object) =>
  ctx.app.inject({ method, url: `/api${url}`, headers, payload })

describe('student results', () => {
  it('appear only after the examiner decided and published, with a per-question breakdown', async () => {
    const { attemptId } = (await call('POST', '/attempts', student, { examId: seeded.exam.id })).json()
    await ctx.deps.db.insert(answers).values([
      { attemptId, questionId: seeded.single.id, value: 'b', seq: 1 },
      { attemptId, questionId: seeded.text.id, value: 'Индекс — это дерево', seq: 2 },
    ])
    await ctx.deps.db.update(attempts).set({ status: 'ready_for_review' }).where(eq(attempts.id, attemptId))
    expect((await call('GET', `/attempts/${attemptId}/result`, student)).statusCode).toBe(404)

    await call('PUT', `/examiner/attempts/${attemptId}/decision`, examiner, {
      verdict: 'clean',
      comment: 'Хорошо, но повторите выбор ответа.',
      score: 64,
    })
    expect((await call('GET', `/attempts/${attemptId}/result`, student)).statusCode).toBe(404) // not published
    await call('POST', `/examiner/exams/${seeded.exam.id}/publish`, examiner)

    const list: StudentExamListItem[] = (await call('GET', '/exams', student)).json()
    expect(list[0]!.attempt).toMatchObject({ status: 'decided', resultReady: true })
    const result: StudentResult = (await call('GET', `/attempts/${attemptId}/result`, student)).json()
    expect(result).toMatchObject({
      score: 64,
      passed: true,
      violation: false,
      reviewer: 'Teacher',
      comment: 'Хорошо, но повторите выбор ответа.',
      questions: [
        { status: 'wrong', earned: 0, answer: 'B', correct: 'A', points: 2 },
        { status: 'examiner', earned: null, answer: 'Индекс — это дерево', correct: null, points: 5 },
      ],
    })
  })

  it('are private to the student', async () => {
    const { attemptId } = (await call('POST', '/attempts', student, { examId: seeded.exam.id })).json()
    const outsider = await signIn(ctx.app, 'outsider@test.edu')
    expect((await call('GET', `/attempts/${attemptId}/result`, outsider)).statusCode).toBe(404)
    expect((await call('GET', `/attempts/${attemptId}/result`, examiner)).statusCode).toBe(403)
  })
})
