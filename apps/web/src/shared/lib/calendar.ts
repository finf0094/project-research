/** Date arithmetic for pickers, in local time (what the person sees on their clock). */
import { KK_MONTHS, KK_WEEKDAYS, KK_WEEKDAYS_SHORT } from './kk-names'

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
  if (locale === 'kk') return [...KK_WEEKDAYS_SHORT.slice(1), KK_WEEKDAYS_SHORT[0]!].map(capitalize)
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

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "November 2026", "қараша 2026": a month heading. */
export function monthTitle(locale: string, year: number, month: number): string {
  if (locale === 'kk') return capitalize(`${KK_MONTHS[month]} ${year}`)
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month, 1))
}

/** "Monday, November 2" (long) or "Mon, November 2" (short), with Kazakh spelled by the app. */
export function weekdayDate(locale: string, ms: number, weekday: 'long' | 'short'): string {
  if (locale !== 'kk') return new Intl.DateTimeFormat(locale, { weekday, day: 'numeric', month: 'long' }).format(ms)
  const d = new Date(ms)
  const names = weekday === 'long' ? KK_WEEKDAYS : KK_WEEKDAYS_SHORT
  return `${d.getDate()} ${KK_MONTHS[d.getMonth()]}, ${names[d.getDay()]}`
}
