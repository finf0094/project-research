import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PASSWORD, createTestContext, seedExam, type TestContext } from './helpers.ts'

let ctx: TestContext
beforeEach(async () => {
  ctx = await createTestContext()
  await seedExam(ctx)
})
afterEach(() => ctx.close())

const login = (email: string, password: string) =>
  ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })

describe('sign-in limits', () => {
  it('slows guessing one account however its email is spelled, but not the rest of the room', async () => {
    const spellings = ['student@test.edu', 'Student@test.edu', 'STUDENT@test.edu', 'student@TEST.edu']
    for (let i = 0; i < 10; i++) expect((await login(spellings[i % 4]!, 'wrong')).statusCode).toBe(401)
    expect((await login('StUdEnT@test.edu', 'wrong')).statusCode).toBe(429)
    // A classmate behind the same address still signs in.
    expect((await login('teacher@test.edu', PASSWORD)).statusCode).toBe(200)
  })
})
