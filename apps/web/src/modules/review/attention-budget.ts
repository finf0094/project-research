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
  let room = Math.max(0, ALERTS_PER_MINUTE - recent.length)
  const shown: Alert[] = []
  let folded = 0
  for (const alert of fresh.toSorted((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])) {
    // High risk always gets through: it is the one thing a proctor must not miss.
    if (alert.kind === 'risk' || room > 0) {
      shown.push(alert)
      room--
    } else folded++
  }
  const alerts: Alert[] = folded
    ? [...shown, { id: `more:${now}`, kind: 'more', name: '', attemptId: '', at: now, count: folded }]
    : shown
  return { alerts, shownAt: [...recent, ...shown.map(() => now)] }
}

/**
 * Puts budgeted alerts on top of the feed. Folded changes join the "N more" line of the last minute rather
 * than adding a line each time, so the feed (and a screen reader) is not flooded with "1 more" lines.
 */
export function addToFeed(feed: Alert[], budgeted: Alert[], now: number, keep: number): Alert[] {
  const more = budgeted.find((a) => a.kind === 'more')
  const top = feed[0]
  if (more && top?.kind === 'more' && now - top.at < MINUTE) {
    const rest = budgeted.filter((a) => a !== more)
    return [
      ...rest.reverse(),
      { ...top, count: (top.count ?? 0) + (more.count ?? 0) },
      ...feed.slice(1),
    ].slice(0, keep)
  }
  return [...budgeted.reverse(), ...feed].slice(0, keep)
}
