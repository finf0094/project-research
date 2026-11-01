import { describe, expect, it } from 'vitest'
import { buildMarkers, type StoredEvent } from './analysis.ts'
import { riskScore } from './risk-score.ts'

const ev = (seq: number, type: string, data: unknown, clientAt: number): StoredEvent => ({
  seq,
  type,
  data,
  clientAt,
})
const opts = { endAt: 300_000, uploaded: new Set<string>(), chainBrokenAt: null }
const kinds = (markers: ReturnType<typeof buildMarkers>) =>
  markers.map((m) => [m.kind, m.startAt, m.endAt, m.status])

describe('the exam page closed or reloaded', () => {
  it('is a marker from when the tab was left until the page came back, and ends what was open', () => {
    const markers = buildMarkers(
      [
        ev(1, 'session.started', {}, 0),
        ev(2, 'proctor.signal', { kind: 'looking_away', active: true }, 50_000),
        ev(3, 'proctor.signal', { kind: 'tab_hidden', active: true }, 60_000),
        ev(4, 'session.resumed', {}, 90_000),
      ],
      opts,
    )
    expect(kinds(markers)).toEqual([
      ['looking_away', 50_000, 60_000, 'pending'],
      ['page_closed', 60_000, 90_000, 'pending'],
    ])
    expect(riskScore(markers)).toBeGreaterThan(0)
  })

  it('counts from the last event when the closing was not recorded, and not for a quick double start', () => {
    const closed = buildMarkers([ev(1, 'session.started', {}, 0), ev(2, 'session.resumed', {}, 40_000)], opts)
    expect(kinds(closed)).toEqual([['page_closed', 0, 40_000, 'pending']])
    const quick = buildMarkers([ev(1, 'session.started', {}, 0), ev(2, 'session.resumed', {}, 500)], opts)
    expect(quick).toEqual([])
  })

  it('shows headphones as context and scores a virtual camera', () => {
    const markers = buildMarkers(
      [
        ev(1, 'proctor.signal', { kind: 'headphones', active: true }, 0),
        ev(2, 'proctor.signal', { kind: 'virtual_camera', active: true }, 0),
      ],
      opts,
    )
    expect(markers.map((m) => [m.kind, m.status])).toEqual([
      ['headphones', 'context'],
      ['virtual_camera', 'pending'],
    ])
    expect(riskScore(markers.filter((m) => m.kind === 'headphones'))).toBe(0)
  })
})
