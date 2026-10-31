/** The largest whole unit of a span, for big "2 дня" numbers: days, else hours, else minutes. */
export function timeLeft(ms: number): { unit: 'days' | 'hours' | 'minutes'; n: number } {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  if (minutes >= 24 * 60) return { unit: 'days', n: Math.floor(minutes / (24 * 60)) }
  if (minutes >= 60) return { unit: 'hours', n: Math.floor(minutes / 60) }
  // The last minutes round up: "0 minutes" would read as "already open".
  return { unit: 'minutes', n: Math.max(0, Math.ceil(ms / 60_000)) }
}
