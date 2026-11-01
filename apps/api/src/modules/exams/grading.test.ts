import { describe, expect, it } from 'vitest'
import { autoScore } from './grading.ts'

describe('autoScore', () => {
  const multiple = { type: 'multiple' as const, correct: ['a', 'b'], points: 2 }

  it('gives the points only for exactly the correct options', () => {
    expect(autoScore(multiple, ['b', 'a'])).toBe(2)
    expect(autoScore(multiple, ['a'])).toBe(0)
    expect(autoScore(multiple, ['a', 'b', 'c'])).toBe(0)
  })

  it('does not let a repeated option stand in for a missing one', () => {
    expect(autoScore(multiple, ['a', 'a'])).toBe(0)
  })
})
