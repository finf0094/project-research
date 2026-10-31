import { ExamDefinition } from '@exam/contracts'
import { describe, expect, it } from 'vitest'
import { emptyExam } from './draft'
import { describeIssues } from './issues'

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
})
