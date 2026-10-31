import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestContext, type TestContext } from './helpers.ts'

let ctx: TestContext
beforeEach(async () => (ctx = await createTestContext()))
afterEach(() => ctx.close())

describe('API docs', () => {
  it('describes the routes from the same contracts that validate them', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/docs/json' })
    expect(res.statusCode).toBe(200)
    const spec = res.json()
    expect(spec.openapi).toMatch(/^3\./)
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining([
        '/api/attempts/{id}/sync',
        '/api/examiner/exams/{id}/definition',
        '/api/admin/users',
      ]),
    )
    // The body schema comes from the Zod contract (strict: unknown keys are rejected).
    const sync = spec.paths['/api/attempts/{id}/sync'].post
    expect(sync.requestBody.content['application/json'].schema).toBeDefined()
  })
})
