import type { AnswerValue } from '@exam/contracts'
import type { questions } from '../../db/schema.ts'

type QuestionRow = Pick<typeof questions.$inferSelect, 'type' | 'correct' | 'points'>

/** Automatic score for choice questions; null means the examiner grades it (free text). */
export function autoScore(question: QuestionRow, value: AnswerValue | null): number | null {
  if (question.type === 'text') return null
  if (value === null) return 0
  // Each option once: ["a", "a"] must not pass for {a, b}.
  const given = [...new Set(Array.isArray(value) ? value : [value])]
  const correct = new Set(question.correct)
  const exact = given.length === correct.size && given.every((id) => correct.has(id))
  return exact ? question.points : 0
}

/**
 * The final score in percent: the examiner's when given; otherwise the automatic one, which can stand
 * only when nothing is open (free-text answers need the examiner).
 */
export function finalScore(
  examinerScore: number | null,
  points: { auto: number; max: number; open: boolean },
) {
  if (examinerScore !== null) return examinerScore
  return !points.open && points.max > 0 ? Math.round((points.auto / points.max) * 100) : null
}
