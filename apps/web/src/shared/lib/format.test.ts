import { describe, expect, it } from 'vitest'
import { formatDuration } from './format'

describe('formatDuration', () => {
  it('formats hours, minutes and seconds', () => {
    expect(formatDuration(5_025_000)).toBe('01:23:45')
  })
  it('never goes below zero', () => {
    expect(formatDuration(-10)).toBe('00:00:00')
  })
})
