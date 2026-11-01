import type { Alert, AlertKind } from './alerts'

/**
 * Section 25.2, the attention budget: a proctor with a hundred students gets at most this many alerts a
 * minute. What does not fit is folded into one quiet line ("N more — see the list"): nothing is hidden,
 * the list of students still shows every change.
 */
export const ALERTS_PER_MINUTE = 2
const MINUTE = 60_000
/** What a proctor should see first when several things happen at once. */
const PRIORITY: Record<AlertKind, number> = {
  risk: 0,
  offline: 1,
  submitted: 2,
  ready: 3,
  online: 4,
  more: 5,
}

export function withinBudget(fresh: Alert[], shownAt: number[], now: number) {
  const recent = shownAt.filter((t) => now - t < MINUTE)
  const room = Math.max(0, ALERTS_PER_MINUTE - recent.length)
  const ordered = fresh.toSorted((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])
  const shown = ordered.slice(0, room)
  const folded = ordered.length - shown.length
  const alerts: Alert[] = folded
    ? [...shown, { id: `more:${now}`, kind: 'more', name: '', attemptId: '', at: now, count: folded }]
    : shown
  return { alerts, shownAt: [...recent, ...shown.map(() => now)] }
}
