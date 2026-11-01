import type { AttemptSession, AuthoredExam } from '@exam/contracts'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

const call = (method: 'GET' | 'POST' | 'PUT', url: string, headers: { cookie: string }, payload?: object) =>
  ctx.app.inject({ method, url: `/api${url}`, headers, payload })
const setException = (email: string, disabledSignals: string[]) =>
  call('PUT', `/examiner/exams/${seeded.exam.id}/exceptions`, examiner, { email, disabledSignals })

describe('individual exceptions (section 25.3)', () => {
  it('reach the student’s session and survive saving the participants again', async () => {
    expect((await setException('student@test.edu', ['noise', 'looking_away'])).statusCode).toBe(204)
    const participants = (await call('GET', `/examiner/exams/${seeded.exam.id}/definition`, examiner)).json()
    const resave = await call('PUT', `/examiner/exams/${seeded.exam.id}/participants`, examiner, {
      emails: (participants as AuthoredExam).participants,
    })
    expect(resave.statusCode).toBe(200)
    const authored: AuthoredExam = (
      await call('GET', `/examiner/exams/${seeded.exam.id}/definition`, examiner)
    ).json()
    expect(authored.exceptions).toEqual([
      { email: 'student@test.edu', disabledSignals: ['noise', 'looking_away'] },
    ])

    const student = await signIn(ctx.app, 'student@test.edu')
    const session: AttemptSession = (
      await call('POST', '/attempts', student, { examId: seeded.exam.id })
    ).json()
    expect(session.disabledSignals).toEqual(['noise', 'looking_away'])
  })

  it('apply only to participants', async () => {
    expect((await setException('outsider@test.edu', ['noise'])).statusCode).toBe(400)
  })
})
