import { describe, expect, it } from 'vitest'
import type { Alert, AlertKind } from './alerts'
import { addToFeed, withinBudget } from './attention-budget'

const alert = (kind: AlertKind, name: string = kind): Alert => ({
  id: name,
  kind,
  name,
  attemptId: name,
  at: 0,
})

describe('attention budget', () => {
  it('shows the most important two a minute and folds the rest into one line', () => {
    const fresh = [alert('online'), alert('submitted'), alert('risk'), alert('offline')]
    const { alerts, shownAt } = withinBudget(fresh, [], 1000)
    expect(alerts.map((a) => a.kind)).toEqual(['risk', 'offline', 'more'])
    expect(alerts[2]!.count).toBe(2)
    // Within the same minute only high risk still gets through on its own…
    expect(withinBudget([alert('offline', 'o2')], shownAt, 30_000).alerts.map((a) => a.kind)).toEqual([
      'more',
    ])
    expect(withinBudget([alert('risk', 'r2')], shownAt, 30_000).alerts.map((a) => a.kind)).toEqual(['risk'])
    // …and a minute later the rest does again.
    expect(withinBudget([alert('offline', 'o2')], shownAt, 62_000).alerts.map((a) => a.kind)).toEqual([
      'offline',
    ])
  })

  it('adds folded changes to the last minute’s "more" line instead of a new line each time', () => {
    const more = (n: number, at: number): Alert => ({
      id: `m${at}`,
      kind: 'more',
      name: '',
      attemptId: '',
      at,
      count: n,
    })
    const feed = addToFeed([], [more(2, 1000)], 1000, 30)
    const next = addToFeed(feed, [more(1, 20_000)], 20_000, 30)
    expect(next).toHaveLength(1)
    expect(next[0]!.count).toBe(3)
  })
})
