import type { AttemptSummary, ExaminerExam } from '@exam/contracts'

/** Where an exam is in its life, as the examiner sees it. */
export type ExamState = 'scheduled' | 'running' | 'review' | 'finished'

export function examState(exam: ExaminerExam, now: number): ExamState {
  if (now < exam.opensAt) return 'scheduled'
  if (now < exam.closesAt || exam.attempts.active > 0) return 'running'
  return exam.attempts.toReview > 0 ? 'review' : 'finished'
}

export const STATE_TONE = { scheduled: 'accent', running: 'lime', review: 'warn', finished: 'ok' } as const

/** Pass mark in percent; a confirmed violation fails whatever the score. */
export const PASS_SCORE = 50

export function passed(attempt: AttemptSummary): boolean | null {
  const result = attempt.result
  if (!result || result.score === null) return null
  return result.verdict !== 'violation' && result.score >= PASS_SCORE
}
