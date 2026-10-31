import { describe, expect, it } from 'vitest'
import { changeType, emptyExam, newQuestion, nextOptionId } from './draft'

describe('exam drafts', () => {
  it('starts a new exam tomorrow at a full hour, open for a week', () => {
    const exam = emptyExam(Date.UTC(2026, 10, 2, 9, 17))
    expect(exam.opensAt).toBe(Date.UTC(2026, 10, 3, 10))
    expect(exam.closesAt - exam.opensAt).toBe(7 * 86_400_000)
  })

  it('finds the next free option id', () => {
    expect(nextOptionId(['a', 'b'])).toBe('c')
    expect(nextOptionId([...'abcdefghijklmnopqrstuvwxyz'])).toBe('a1')
  })

  it('keeps text and points when the type changes, and one answer for single choice', () => {
    const multiple = { ...newQuestion('multiple'), text: 'Q', points: 3, correct: ['a', 'b'] }
    expect(changeType(multiple, 'single')).toMatchObject({ text: 'Q', points: 3, correct: ['a'] })
    expect(changeType(multiple, 'text')).toMatchObject({ text: 'Q', options: [], correct: [] })
    expect(changeType(changeType(multiple, 'text'), 'single').options).toHaveLength(2)
  })
})
