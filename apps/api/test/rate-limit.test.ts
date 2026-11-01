import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loginAttempts } from '../src/modules/auth/login-attempts.ts'
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

describe('sign-in attempts counter', () => {
  it('counts attempts from their start, clears on success and stays bounded', () => {
    const clock = { now: 0 }
    const attempts = loginAttempts(() => clock.now, 3, 60_000, 4)
    // A burst sent at once: the fourth waits although none has failed yet.
    expect([1, 2, 3, 4].map(() => attempts.begin('ip', 'A@x'))).toEqual([true, true, true, false])
    attempts.succeeded('ip', 'a@x')
    expect(attempts.begin('ip', 'a@x')).toBe(true)
    clock.now = 61_000
    for (let i = 0; i < 3; i++) attempts.begin('ip', 'b@x')
    expect(attempts.begin('ip', 'b@x')).toBe(false)
    // Many pairs: the oldest are dropped, memory stays bounded.
    for (let i = 0; i < 100; i++) attempts.begin(`ip${i}`, 'c@x')
    expect(attempts.begin('ip', 'b@x')).toBe(true)
  })
})
