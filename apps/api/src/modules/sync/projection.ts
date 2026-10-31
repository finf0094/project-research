import type { AnswerValue } from '@exam/contracts'
import type { questions } from '../../db/schema.ts'

type QuestionRow = Pick<typeof questions.$inferSelect, 'id' | 'type' | 'options'>

/** Checks that an answer fits its question; invalid answers stay in the chain but are not graded. */
export function isValidAnswer(question: QuestionRow, value: AnswerValue): boolean {
  const optionIds = new Set(question.options.map((o) => o.id))
  switch (question.type) {
    case 'text':
      return typeof value === 'string'
    case 'single':
      return typeof value === 'string' && (value === '' || optionIds.has(value))
    case 'multiple':
      return (
        Array.isArray(value) && new Set(value).size === value.length && value.every((id) => optionIds.has(id))
      )
  }
}

/**
 * An answer counts if it was written before the deadline and reached the server within the offline window.
 * `at` comes from the client, so it is trusted only inside that window (documented tamper-evident limit).
 */
export function countsTowardGrade(at: number, receivedAt: number, deadline: number, offlineWindowMs: number) {
  return at <= deadline && receivedAt <= deadline + offlineWindowMs
}

export interface AnswerEvent {
  seq: number
  data: { questionId: string; value: AnswerValue }
  clientAt: number
  receivedAt: number
}

/**
 * Final answers rebuilt from the whole log against the final deadline. Sync projects answers live,
 * but a later deadline extension can make earlier-rejected answers count, so analysis recomputes.
 */
export function projectAnswers(
  log: AnswerEvent[],
  examQuestions: QuestionRow[],
  deadline: number,
  offlineWindowMs: number,
): Map<string, { value: AnswerValue; seq: number }> {
  const byId = new Map(examQuestions.map((q) => [q.id, q]))
  const result = new Map<string, { value: AnswerValue; seq: number }>()
  for (const e of log.toSorted((a, b) => a.seq - b.seq)) {
    const question = byId.get(e.data.questionId)
    if (!question || !isValidAnswer(question, e.data.value)) continue
    if (!countsTowardGrade(e.clientAt, e.receivedAt, deadline, offlineWindowMs)) continue
    result.set(question.id, { value: e.data.value, seq: e.seq })
  }
  return result
}
