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
  it('shows at most two a minute, most important first, and folds the rest into one line', () => {
    const fresh = [alert('online'), alert('submitted'), alert('risk'), alert('offline')]
    const { alerts, shown } = withinBudget(fresh, [], 1000)
    expect(alerts.map((a) => a.kind)).toEqual(['risk', 'offline', 'more'])
    expect(alerts[2]!.count).toBe(2)
    // The minute's budget is spent: even high risk waits in the "more" line (the list shows it)…
    expect(withinBudget([alert('risk', 'r2')], shown, 30_000).alerts.map((a) => a.kind)).toEqual(['more'])
    // …and a minute later alerts get through again.
    expect(withinBudget([alert('offline', 'o2')], shown, 62_000).alerts.map((a) => a.kind)).toEqual([
      'offline',
    ])
  })

  it('keeps one place a minute for high risk', () => {
    const { shown } = withinBudget([alert('offline')], [], 1000)
    expect(withinBudget([alert('submitted')], shown, 2000).alerts.map((a) => a.kind)).toEqual(['more'])
    const risks = [alert('risk', 'r1'), alert('risk', 'r2')]
    expect(withinBudget(risks, shown, 2000).alerts.map((a) => a.kind)).toEqual(['risk', 'more'])
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

  it('folds into this minute’s "more" line even when a risk alert came above it', () => {
    const more = (n: number, at: number): Alert => ({
      id: `m${at}`,
      kind: 'more',
      name: '',
      attemptId: '',
      at,
      count: n,
    })
    const feed = addToFeed(addToFeed([], [more(2, 1000)], 1000, 30), [alert('risk')], 5000, 30)
    const next = addToFeed(feed, [more(1, 20_000)], 20_000, 30)
    expect(next.map((a) => [a.kind, a.count])).toEqual([
      ['risk', undefined],
      ['more', 3],
    ])
  })
})
