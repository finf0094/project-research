import { describe, expect, it } from 'vitest'
import { atTime, daysBetween, monthGrid, onDay, sameDay, timeOf, weekdayNames } from './calendar'

describe('calendar', () => {
  it('lays a month out in six weeks starting on Monday', () => {
    const grid = monthGrid(2026, 10) // November 2026 starts on a Sunday
    expect(grid).toHaveLength(42)
    expect(new Date(grid[0]!).getDay()).toBe(1)
    expect(new Date(grid[0]!).getDate()).toBe(26) // 26 October
    expect(grid.findIndex((d) => sameDay(d, new Date(2026, 10, 1).getTime()))).toBe(6)
  })

  it('names the weekdays from Monday in the interface language', () => {
    expect(weekdayNames('en')[0]).toBe('Mon')
    expect(weekdayNames('ru')[6]!.toLowerCase()).toBe('вс')
  })

  it('moves a time onto a day and a day onto a time', () => {
    const at = new Date(2026, 10, 2, 16, 30).getTime()
    expect(timeOf(at)).toBe('16:30')
    expect(timeOf(atTime(at, '09:05'))).toBe('09:05')
    const moved = onDay(new Date(2026, 10, 9).getTime(), at)
    expect(new Date(moved).getDate()).toBe(9)
    expect(timeOf(moved)).toBe('16:30')
  })

  it('counts calendar days', () => {
    expect(daysBetween(new Date(2026, 10, 2, 23).getTime(), new Date(2026, 10, 3, 1).getTime())).toBe(1)
    expect(daysBetween(new Date(2026, 10, 2).getTime(), new Date(2026, 10, 2, 20).getTime())).toBe(0)
  })
})
