import { describe, expect, it } from 'vitest'
import { buildMarkers, riskScore, type StoredEvent } from './analysis.ts'

const ev = (seq: number, type: string, data: unknown, clientAt: number): StoredEvent => ({
  seq,
  type,
  data,
  clientAt,
})
const none = new Set<string>()

describe('buildMarkers', () => {
  it('pairs signal on/off events into an interval', () => {
    const markers = buildMarkers(
      [
        ev(1, 'proctor.signal', { kind: 'tab_hidden', active: true }, 1000),
        ev(2, 'proctor.signal', { kind: 'tab_hidden', active: false }, 5000),
      ],
      { endAt: 9000, uploaded: none, chainBrokenAt: null },
    )
    expect(markers).toEqual([
      { kind: 'tab_hidden', startAt: 1000, endAt: 5000, status: 'pending', chunks: [] },
    ])
  })

  it('treats offline periods and darkness as context, never as violations', () => {
    const markers = buildMarkers(
      [
        ev(1, 'network.changed', { from: 'online', to: 'offline' }, 1000),
        ev(2, 'proctor.signal', { kind: 'too_dark', active: true }, 1500),
        ev(3, 'network.changed', { from: 'offline', to: 'online' }, 4000),
      ],
      { endAt: 9000, uploaded: none, chainBrokenAt: null },
    )
    expect(markers.map((m) => [m.kind, m.status])).toEqual([
      ['offline', 'context'],
      ['too_dark', 'context'],
    ])
    expect(riskScore(markers)).toBe(0)
  })

  it('attaches uploaded chunks and flags missing ones', () => {
    const markers = buildMarkers(
      [
        ev(1, 'proctor.signal', { kind: 'multiple_faces', active: true }, 2000),
        ev(2, 'evidence.fragment', { reason: 'risk', tStart: 1000, tEnd: 3000, chunks: ['a', 'b'] }, 3000),
      ],
      { endAt: 4000, uploaded: new Set(['a']), chainBrokenAt: null },
    )
    expect(markers.find((m) => m.kind === 'multiple_faces')).toMatchObject({ endAt: 4000, chunks: ['a'] })
    expect(markers.some((m) => m.kind === 'missing_fragment')).toBe(true)
  })

  it('flags a control fragment the server asked for but never received', () => {
    const answeredRequest = buildMarkers(
      [
        ev(
          1,
          'evidence.fragment',
          { reason: 'control', tStart: 61_000, tEnd: 81_000, chunks: ['a'] },
          81_000,
        ),
      ],
      { endAt: 900_000, uploaded: new Set(['a']), chainBrokenAt: null, captureRequests: [60_000] },
    )
    expect(answeredRequest.some((m) => m.kind === 'missing_fragment')).toBe(false)
    const ignored = buildMarkers([], {
      endAt: 900_000,
      uploaded: none,
      chainBrokenAt: null,
      captureRequests: [60_000],
    })
    expect(ignored).toEqual([expect.objectContaining({ kind: 'missing_fragment', startAt: 60_000 })])
  })

  it('adds a marker for a broken chain and caps the score at 100', () => {
    const markers = buildMarkers([ev(1, 'proctor.signal', { kind: 'multiple_faces', active: true }, 0)], {
      endAt: 3_600_000,
      uploaded: none,
      chainBrokenAt: 2,
    })
    expect(markers.some((m) => m.kind === 'chain_broken')).toBe(true)
    expect(riskScore(markers)).toBe(100)
  })
})
