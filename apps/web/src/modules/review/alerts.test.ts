import type { AttemptSummary } from '@exam/contracts'
import { describe, expect, it } from 'vitest'
import { alertsBetween } from './alerts'

const attempt = (over: Partial<AttemptSummary>): AttemptSummary =>
  ({
    id: 'a1',
    student: { id: 's1', name: 'Алия' },
    status: 'active',
    connection: 'online',
    riskScore: null,
    ...over,
  }) as AttemptSummary

describe('alertsBetween', () => {
  it('announces what a proctor must know, once', () => {
    const kinds = (before: Partial<AttemptSummary>, after: Partial<AttemptSummary>) =>
      alertsBetween([attempt(before)], [attempt(after)], 0).map((a) => a.kind)
    expect(kinds({}, { connection: 'offline' })).toEqual(['offline'])
    expect(kinds({ connection: 'offline' }, { connection: 'online' })).toEqual(['online'])
    expect(kinds({}, { status: 'submitted', connection: null })).toEqual(['submitted'])
    expect(kinds({ status: 'submitted' }, { status: 'ready_for_review', riskScore: 72 })).toEqual([
      'risk',
      'ready',
    ])
    expect(kinds({ riskScore: 70 }, { riskScore: 80 })).toEqual([]) // already high: no repeat
  })

  it('stays quiet about new attempts and unchanged ones', () => {
    expect(alertsBetween([], [attempt({})], 0)).toEqual([])
    expect(alertsBetween([attempt({})], [attempt({})], 0)).toEqual([])
  })
})
