import { ExamDefinition } from '@exam/contracts'
import { describe, expect, it } from 'vitest'
import { emptyExam } from './draft'
import { describeIssues, questionsWithIssues } from './issues'

const t = (key: string, values?: Record<string, unknown>) => (values ? `${key}(${values.n})` : key)

describe('describeIssues', () => {
  it('names each wrong field once, by its label', () => {
    const draft = emptyExam(0)
    const result = ExamDefinition.safeParse({ ...draft, title: ' ' })
    expect(result.success).toBe(false)
    // The new exam's first question is still empty: its text, its options and no correct answer.
    expect(describeIssues(result.error!.issues, t).sort()).toEqual([
      'authoring.questions.number(1): authoring.issues.correct',
      'authoring.questions.number(1): authoring.questions.options',
      'authoring.questions.number(1): authoring.questions.text',
      'authoring.settings.name',
    ])
  })

  it('points at the questions that need fixing', () => {
    const draft = emptyExam(0)
    const fine = {
      ...draft.questions[0]!,
      text: 'Q',
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      correct: ['a'],
    }
    const result = ExamDefinition.safeParse({ ...draft, title: 'T', questions: [fine, draft.questions[0]!] })
    expect([...questionsWithIssues(result.error!.issues)]).toEqual([1])
  })
})
