import { afterEach, describe, expect, it } from 'vitest'
import { formatDateTime, formatDuration, setFormatLocale } from './format'

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
  })
})
