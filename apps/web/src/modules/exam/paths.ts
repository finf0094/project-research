import type { ExamMode } from '@exam/contracts'

/** Where a running attempt is taken: an oral exam is a live call, a written one a question sheet. */
export const attemptPath = (attemptId: string, mode: ExamMode) =>
  mode === 'oral' ? `/attempts/${attemptId}/oral` : `/attempts/${attemptId}`
