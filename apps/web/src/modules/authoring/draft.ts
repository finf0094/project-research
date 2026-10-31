import type { ExamDefinition, QuestionInput, QuestionType } from '@exam/contracts'

const HOUR = 3_600_000

/** A new exam: opens tomorrow at the next full hour for a week, one question to start from. */
export function emptyExam(now: number): ExamDefinition {
  const opensAt = Math.ceil((now + 24 * HOUR) / HOUR) * HOUR
  return {
    title: '',
    durationMin: 60,
    opensAt,
    closesAt: opensAt + 7 * 24 * HOUR,
    profile: { mode: 'written', recording: 'adaptive' },
    questions: [newQuestion('single')],
  }
}

export function newQuestion(type: QuestionType): QuestionInput {
  if (type === 'text') return { type, text: '', options: [], correct: [], points: 5 }
  return {
    type,
    text: '',
    options: [
      { id: 'a', text: '' },
      { id: 'b', text: '' },
    ],
    correct: [],
    points: 2,
  }
}

/** Next free option id: a, b, … z, then a1, b1, … */
export function nextOptionId(taken: string[]): string {
  for (let round = 0; ; round++) {
    for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
      const id = round ? `${letter}${round}` : letter
      if (!taken.includes(id)) return id
    }
  }
}

/** Switching the type keeps the text and points; options only make sense for choice questions. */
export function changeType(q: QuestionInput, type: QuestionType): QuestionInput {
  if (type === 'text') return { ...q, type, options: [], correct: [] }
  const base = q.type === 'text' ? newQuestion(type) : q
  return {
    ...base,
    text: q.text,
    points: q.points,
    type,
    correct: type === 'single' ? base.correct.slice(0, 1) : base.correct,
  }
}
