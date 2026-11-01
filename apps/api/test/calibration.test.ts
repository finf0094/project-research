import type { Calibration } from '@exam/contracts'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { markers } from '../src/db/schema.ts'
import { riskScore, type MarkerDraft } from '../src/jobs/analysis.ts'
import { calibrationFactor } from '../src/modules/review/calibration.ts'
import { createTestContext, seedExam, signIn, type TestContext } from './helpers.ts'

describe('calibration factor (section 25.4)', () => {
  it('keeps the weight until there are enough decisions, then follows how often markers were right', () => {
    expect(calibrationFactor(0, 3)).toBe(1) // too few to say
    expect(calibrationFactor(5, 5)).toBe(1) // right as often as wrong
    expect(calibrationFactor(0, 20)).toBe(0.25) // noise: counts far less
    expect(calibrationFactor(20, 0)).toBe(1) // reliable: keeps its weight (only noise is turned down)
  })

  it('lowers a noisy kind in the review priority', () => {
    const noise: MarkerDraft = {
      kind: 'noise',
      startAt: 0,
      endAt: 120_000,
      status: 'pending',
      source: 'client',
      discrepancy: false,
      chunks: [],
    }
    expect(riskScore([noise], { noise: 0.25 })).toBeLessThan(riskScore([noise]))
  })
})

describe('GET /examiner/calibration', () => {
  let ctx: TestContext
  beforeEach(async () => {
    ctx = await createTestContext()
  })
  afterEach(() => ctx.close())

  it('counts the examiner’s decisions per kind across their exams', async () => {
    const seeded = await seedExam(ctx)
    const student = await signIn(ctx.app, 'student@test.edu')
    const started = await ctx.app.inject({
      method: 'POST',
      url: '/api/attempts',
      headers: student,
      payload: { examId: seeded.exam.id },
    })
    const { attemptId } = started.json()
    const marker = { attemptId, kind: 'noise' as const, startAt: 0, endAt: 1000, chunks: [] }
    await ctx.deps.db.insert(markers).values([
      ...Array.from({ length: 6 }, () => ({ ...marker, status: 'dismissed' as const })),
      { ...marker, status: 'confirmed' as const },
      { ...marker, status: 'pending' as const }, // not decided: not counted
    ])
    const examiner = await signIn(ctx.app, 'teacher@test.edu')
    const res = await ctx.app.inject({ method: 'GET', url: '/api/examiner/calibration', headers: examiner })
    const result: Calibration = res.json()
    expect(result.kinds).toEqual([
      { kind: 'noise', confirmed: 1, dismissed: 6, factor: calibrationFactor(1, 6) },
    ])
    expect(result.control).toEqual({ unmarked: 0, missed: 0 }) // that attempt had markers and is not decided
  })
})
