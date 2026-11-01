import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PASSWORD, createTestContext, seedExam, type TestContext } from './helpers.ts'

let ctx: TestContext
beforeEach(async () => {
  ctx = await createTestContext()
  await seedExam(ctx)
})
afterEach(() => ctx.close())

const login = (email: string, password: string, remoteAddress = '10.0.0.1') =>
  ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password }, remoteAddress })

describe('sign-in limits', () => {
  it('slows guessing one account from one address however its email is spelled, and nobody else', async () => {
    const spellings = ['student@test.edu', 'Student@test.edu', 'STUDENT@test.edu', 'student@TEST.edu']
    for (let i = 0; i < 10; i++) expect((await login(spellings[i % 4]!, 'wrong')).statusCode).toBe(401)
    expect((await login('StUdEnT@test.edu', 'wrong')).statusCode).toBe(429)
    // A classmate behind the same address still signs in, and the student from their own device too.
    expect((await login('teacher@test.edu', PASSWORD)).statusCode).toBe(200)
    expect((await login('student@test.edu', PASSWORD, '10.0.0.2')).statusCode).toBe(200)
  })
})
