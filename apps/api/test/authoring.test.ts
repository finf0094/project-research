import type { AuthoredExam, ExamDefinition } from '@exam/contracts'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { users } from '../src/db/schema.ts'
import { hashPassword } from '../src/modules/auth/service.ts'
import { PASSWORD, createTestContext, seedExam, signIn, type TestContext } from './helpers.ts'

let ctx: TestContext
let seeded: Awaited<ReturnType<typeof seedExam>>
let examiner: { cookie: string }

beforeEach(async () => {
  ctx = await createTestContext()
  seeded = await seedExam(ctx)
  examiner = await signIn(ctx.app, 'teacher@test.edu')
})
afterEach(() => ctx.close())

const definition = (over: Partial<ExamDefinition> = {}): ExamDefinition => ({
  title: 'Алгоритмы',
  durationMin: 45,
  opensAt: ctx.clock.now,
  closesAt: ctx.clock.now + 86_400_000,
  profile: { mode: 'written', recording: 'adaptive' },
  questions: [
    {
      type: 'single',
      text: 'Сложность бинарного поиска?',
      options: [
        { id: 'a', text: 'O(log n)' },
        { id: 'b', text: 'O(n)' },
      ],
      correct: ['a'],
      points: 2,
    },
    { type: 'text', text: 'Опишите быструю сортировку.', options: [], correct: [], points: 5 },
  ],
  ...over,
})

const call = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown, headers = examiner) =>
  ctx.app.inject({ method, url: `/api${url}`, headers, payload: payload as object })

describe('exam authoring', () => {
  it('creates an exam, reads it back with the correct answers, and replaces it', async () => {
    const created = await call('POST', '/examiner/exams', definition())
    expect(created.statusCode, created.body).toBe(200)
    const { id } = created.json()
    const read: AuthoredExam = (await call('GET', `/examiner/exams/${id}/definition`)).json()
    expect(read).toMatchObject({ locked: false, participants: [], definition: definition() })

    const changed = definition({ title: 'Алгоритмы II', questions: definition().questions.slice(1) })
    expect((await call('PUT', `/examiner/exams/${id}/definition`, changed)).statusCode).toBe(204)
    expect((await call('GET', `/examiner/exams/${id}/definition`)).json().definition).toEqual(changed)
  })

  it('rejects questions that cannot be graded', async () => {
    const twoCorrect = definition({
      questions: [{ ...definition().questions[0]!, correct: ['a', 'b'] }],
    })
    expect((await call('POST', '/examiner/exams', twoCorrect)).statusCode).toBe(400)
    const unknownOption = definition({ questions: [{ ...definition().questions[0]!, correct: ['z'] }] })
    expect((await call('POST', '/examiner/exams', unknownOption)).statusCode).toBe(400)
    const openOnly = [definition().questions[1]!, definition().questions[1]!]
    const oral = (ticketSize?: number, questions = openOnly) =>
      definition({ profile: { mode: 'oral', recording: 'full', ticketSize }, questions })
    expect((await call('POST', '/examiner/exams', oral(5))).statusCode).toBe(400) // ticket larger than the pool
    expect((await call('POST', '/examiner/exams', oral(undefined))).statusCode).toBe(400) // no ticket size
    expect((await call('POST', '/examiner/exams', oral(1, definition().questions))).statusCode).toBe(400) // a choice question
    expect((await call('POST', '/examiner/exams', oral(2))).statusCode).toBe(200)
    expect((await call('POST', '/examiner/exams', definition({ title: '   ' }))).statusCode).toBe(400)
  })

  it('freezes questions once a student has started, but participants can still change', async () => {
    const student = await signIn(ctx.app, 'student@test.edu')
    const start = await ctx.app.inject({
      method: 'POST',
      url: '/api/attempts',
      headers: student,
      payload: { examId: seeded.exam.id },
    })
    expect(start.statusCode).toBe(200)
    const read: AuthoredExam = (await call('GET', `/examiner/exams/${seeded.exam.id}/definition`)).json()
    expect(read.locked).toBe(true)
    expect(
      (await call('PUT', `/examiner/exams/${seeded.exam.id}/definition`, read.definition)).statusCode,
    ).toBe(409)

    // The student who started stays even when left out; unknown emails are reported.
    const res = await call('PUT', `/examiner/exams/${seeded.exam.id}/participants`, {
      emails: ['Outsider@test.edu', 'nobody@test.edu'],
    })
    expect(res.json()).toEqual({
      participants: ['outsider@test.edu', 'student@test.edu'],
      unknown: ['nobody@test.edu'],
    })
  })

  it('keeps exams to their owner and authoring to examiners', async () => {
    const student = await signIn(ctx.app, 'student@test.edu')
    expect((await call('POST', '/examiner/exams', definition(), student)).statusCode).toBe(403)
    await ctx.deps.db.insert(users).values({
      email: 'other@test.edu',
      name: 'Other',
      role: 'examiner',
      passwordHash: await hashPassword(PASSWORD),
    })
    const other = await signIn(ctx.app, 'other@test.edu')
    expect(
      (await call('GET', `/examiner/exams/${seeded.exam.id}/definition`, undefined, other)).statusCode,
    ).toBe(404)
  })
})

describe('user administration', () => {
  it('lets the administrator create accounts that can sign in, once per email', async () => {
    await ctx.deps.db.insert(users).values({
      email: 'admin@test.edu',
      name: 'Admin',
      role: 'admin',
      passwordHash: await hashPassword(PASSWORD),
    })
    const admin = await signIn(ctx.app, 'admin@test.edu')
    const newUser = {
      email: 'New@Test.edu',
      name: 'Новый студент',
      role: 'student',
      password: 'long-enough-1',
    }
    const created = await call('POST', '/admin/users', newUser, admin)
    expect(created.json()).toMatchObject({ email: 'new@test.edu', role: 'student' })
    expect((await call('POST', '/admin/users', newUser, admin)).statusCode).toBe(409)
    expect((await call('GET', '/admin/users', undefined, admin)).json()).toHaveLength(5)

    const login = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'new@test.edu', password: 'long-enough-1' },
    })
    expect(login.statusCode).toBe(200)
    expect((await call('GET', '/admin/users', undefined, examiner)).statusCode).toBe(403)
  })
})
