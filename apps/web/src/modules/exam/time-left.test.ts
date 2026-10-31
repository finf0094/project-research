import { describe, expect, it } from 'vitest'
import { timeLeft } from './time-left'

describe('timeLeft', () => {
  it('picks the largest whole unit', () => {
    expect(timeLeft(2 * 86_400_000 + 5_000_000)).toEqual({ unit: 'days', n: 2 })
    expect(timeLeft(5 * 3_600_000 + 1)).toEqual({ unit: 'hours', n: 5 })
    expect(timeLeft(90_000)).toEqual({ unit: 'minutes', n: 1 })
    expect(timeLeft(-1)).toEqual({ unit: 'minutes', n: 0 })
  })
})
