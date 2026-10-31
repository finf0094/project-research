import { describe, expect, it } from 'vitest'
import { projectAnswers } from './projection.ts'

const q = {
  id: 'q1',
  type: 'single' as const,
  options: [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
  ],
}
const answer = (seq: number, value: string, clientAt: number, receivedAt = clientAt) => ({
  seq,
  data: { questionId: 'q1', value },
  clientAt,
  receivedAt,
})

describe('projectAnswers', () => {
  it('keeps the latest valid answer written before the deadline', () => {
    const result = projectAnswers(
      [answer(1, 'a', 10), answer(2, 'zzz', 20), answer(3, 'b', 30), answer(4, 'a', 200)],
      [q],
      100,
      0,
    )
    expect(result.get('q1')).toEqual({ value: 'b', seq: 3 })
  })

  it('counts offline answers that arrive within the window, not later', () => {
    expect(projectAnswers([answer(1, 'a', 90, 150)], [q], 100, 60).size).toBe(1)
    expect(projectAnswers([answer(1, 'a', 90, 170)], [q], 100, 60).size).toBe(0)
  })
})
