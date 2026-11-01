import { describe, expect, it } from 'vitest'
import type { Alert, AlertKind } from './alerts'
import { withinBudget } from './attention-budget'

const alert = (kind: AlertKind, name: string = kind): Alert => ({ id: name, kind, name, attemptId: name, at: 0 })

describe('attention budget', () => {
  it('shows the most important two a minute and folds the rest into one line', () => {
    const fresh = [alert('online'), alert('submitted'), alert('risk'), alert('offline')]
    const { alerts, shownAt } = withinBudget(fresh, [], 1000)
    expect(alerts.map((a) => a.kind)).toEqual(['risk', 'offline', 'more'])
    expect(alerts[2]!.count).toBe(2)
    // Within the same minute nothing more gets through on its own…
    expect(withinBudget([alert('risk', 'r2')], shownAt, 30_000).alerts.map((a) => a.kind)).toEqual(['more'])
    // …and a minute later it does again.
    expect(withinBudget([alert('risk', 'r2')], shownAt, 62_000).alerts.map((a) => a.kind)).toEqual(['risk'])
  })
})
