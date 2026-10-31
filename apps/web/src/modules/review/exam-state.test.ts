import type { AttemptSummary, ExaminerExam } from '@exam/contracts'
import { describe, expect, it } from 'vitest'
import { examState, passed } from './exam-state'

const exam = (over: Partial<ExaminerExam['attempts']> = {}) =>
  ({ opensAt: 100, closesAt: 200, attempts: { total: 3, active: 0, toReview: 0, ...over } }) as ExaminerExam

describe('examState', () => {
  it('follows the exam from scheduled to finished', () => {
    expect(examState(exam(), 50)).toBe('scheduled')
    expect(examState(exam(), 150)).toBe('running')
    expect(examState(exam({ active: 1 }), 250)).toBe('running') // someone still finishing (offline window)
    expect(examState(exam({ toReview: 2 }), 250)).toBe('review')
    expect(examState(exam(), 250)).toBe('finished')
  })
})

describe('passed', () => {
  const attempt = (result: AttemptSummary['result']) => ({ result }) as AttemptSummary
  it('needs a score and no confirmed violation', () => {
    expect(passed(attempt(null))).toBeNull()
    expect(passed(attempt({ verdict: 'clean', score: null }))).toBeNull()
    expect(passed(attempt({ verdict: 'clean', score: 50 }))).toBe(true)
    expect(passed(attempt({ verdict: 'clean', score: 49 }))).toBe(false)
    expect(passed(attempt({ verdict: 'violation', score: 95 }))).toBe(false)
  })
})
