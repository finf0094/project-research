import { PASS_SCORE, type AttemptSummary, type ExaminerExam } from '@exam/contracts'

/** Where an exam is in its life, as the examiner sees it. */
export type ExamState = 'scheduled' | 'running' | 'review' | 'finished'

export function examState(exam: ExaminerExam, now: number): ExamState {
  if (now < exam.opensAt) return 'scheduled'
  if (now < exam.closesAt || exam.attempts.active > 0) return 'running'
  return exam.attempts.toReview > 0 ? 'review' : 'finished'
}

export const STATE_TONE = { scheduled: 'accent', running: 'lime', review: 'warn', finished: 'ok' } as const

/** The score that counts (the server gives none while undecided or sent back for more review). */
export const finalScore = (attempt: AttemptSummary): number | null => attempt.result?.score ?? null

export function passed(attempt: AttemptSummary): boolean | null {
  const score = finalScore(attempt)
  if (score === null) return null
  return attempt.result!.verdict !== 'violation' && score >= PASS_SCORE
}
