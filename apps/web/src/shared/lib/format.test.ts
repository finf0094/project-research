import { afterEach, describe, expect, it } from 'vitest'
import {
  countdownParts,
  formatClock,
  formatClockOrDate,
  formatDateTime,
  formatDay,
  formatDuration,
  setFormatLocale,
} from './format'

describe('formatDuration', () => {
  it('formats hours, minutes and seconds', () => {
    expect(formatDuration(5_025_000)).toBe('01:23:45')
  })
  it('never goes below zero', () => {
    expect(formatDuration(-10)).toBe('00:00:00')
  })
})

describe('formatDateTime', () => {
  afterEach(() => setFormatLocale('ru'))

  it('spells Kazakh months itself, since browsers often lack the data', () => {
    setFormatLocale('kk')
    expect(formatDateTime(new Date(2026, 9, 31, 9, 5).getTime())).toBe('31 қазан, 09:05')
    expect(formatDay(new Date(2026, 9, 31).getTime())).toBe('31 қазан')
  })
})

describe('countdownParts', () => {
  it('keeps whole days apart from the clock', () => {
    expect(countdownParts((2 * 86_400 + 3_600 + 61) * 1000)).toEqual({ days: 2, clock: '01:01:01' })
    expect(countdownParts(-5)).toEqual({ days: 0, clock: '00:00:00' })
  })
})

describe('formatClockOrDate', () => {
  it('shows the bare time on the same day and the date on another day', () => {
    const at = new Date(2026, 10, 1, 10, 33).getTime()
    expect(formatClockOrDate(at, new Date(2026, 10, 1, 8, 0).getTime())).toBe(formatClock(at))
    expect(formatClockOrDate(at, new Date(2026, 9, 25, 8, 0).getTime())).toBe(formatDateTime(at))
  })
})
