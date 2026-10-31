import type { AnswerValue } from '@exam/contracts'
import type { questions } from '../../db/schema.ts'

type QuestionRow = Pick<typeof questions.$inferSelect, 'type' | 'correct' | 'points'>

/** Automatic score for choice questions; null means the examiner grades it (free text). */
export function autoScore(question: QuestionRow, value: AnswerValue | null): number | null {
  if (question.type === 'text') return null
  if (value === null) return 0
  const given = Array.isArray(value) ? value : [value]
  const correct = new Set(question.correct)
  const exact = given.length === correct.size && given.every((id) => correct.has(id))
  return exact ? question.points : 0
}
