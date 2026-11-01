/** Date arithmetic for pickers, in local time (what the person sees on their clock). */

const DAY_MS = 86_400_000

/** Midnight of the day `ms` falls on. */
export function startOfDay(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export const sameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b)

/** The 42 days (six weeks, Monday first) shown for a month, including the neighbours' edges. */
export function monthGrid(year: number, month: number): number[] {
  const first = new Date(year, month, 1)
  const back = (first.getDay() + 6) % 7 // days since Monday
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - back + i).getTime())
}

/** Short weekday names, Monday first, in the given language ("Пн", "Mon"). */
export function weekdayNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  // 5 January 2026 was a Monday.
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(2026, 0, 5 + i)))
}

/** The same moment's time of day, moved onto another day. */
export function onDay(day: number, time: number): number {
  const t = new Date(time)
  const d = new Date(day)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.getHours(), t.getMinutes()).getTime()
}

/** "HH:MM" of a moment, and the moment with that time of day. */
export function timeOf(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function atTime(ms: number, time: string): number {
  const [h = 0, m = 0] = time.split(':').map(Number)
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime()
}

/** Whole days between two moments, by the calendar (not by 24-hour spans). */
export const daysBetween = (from: number, to: number) =>
  Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS)
