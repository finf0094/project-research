import { sameDay } from './calendar'
import { KK_MONTHS } from './kk-names'

const pad = (n: number) => String(n).padStart(2, '0')

/** 5_025_000 → "01:23:45"; negative values clamp to zero. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}


/** A countdown split for display: whole days apart, the rest as "23:12:17". */
export function countdownParts(ms: number): { days: number; clock: string } {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86_400)
  return { days, clock: formatDuration((total % 86_400) * 1000) }
}

let locale = 'ru'
let timeFormat: Intl.DateTimeFormat
let dateFormat: Intl.DateTimeFormat
let dayFormat: Intl.DateTimeFormat
let clockFormat: Intl.DateTimeFormat

/** Dates follow the interface language; the app calls this whenever the language changes. */
export function setFormatLocale(next: string) {
  locale = next
  timeFormat = new Intl.DateTimeFormat(next, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  dateFormat = new Intl.DateTimeFormat(next, {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
  dayFormat = new Intl.DateTimeFormat(next, { day: 'numeric', month: 'long' })
  clockFormat = new Intl.DateTimeFormat(next, { hour: '2-digit', minute: '2-digit' })
}
setFormatLocale('ru')

export const formatTime = (ts: number) => timeFormat.format(ts)
/** "14:30": hours and minutes, for schedules. */
export const formatClock = (ts: number) => clockFormat.format(ts)

/** "14:30" when `ts` falls on the same day as `from` (now by default), "8 ноября, 14:30" otherwise:
 * a bare time for a moment days away reads as today. */
export function formatClockOrDate(ts: number, from = Date.now()): string {
  return sameDay(ts, from) ? formatClock(ts) : formatDateTime(ts)
}

export function formatDateTime(ts: number): string {
  if (locale !== 'kk') return dateFormat.format(ts)
  const d = new Date(ts)
  return `${d.getDate()} ${KK_MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "4 ноября": the day alone, for tiles and headers. */
export function formatDay(ts: number): string {
  if (locale !== 'kk') return dayFormat.format(ts)
  const d = new Date(ts)
  return `${d.getDate()} ${KK_MONTHS[d.getMonth()]}`
}
