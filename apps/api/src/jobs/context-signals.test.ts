import { describe, expect, it } from 'vitest'
import { buildMarkers, type StoredEvent } from './analysis.ts'
import { riskScore } from './risk-score.ts'

const ev = (seq: number, type: string, data: unknown, clientAt: number): StoredEvent => ({
  seq,
  type,
  data,
  clientAt,
})
const opts = { endAt: 120_000, uploaded: new Set<string>(), chainBrokenAt: null }

describe('signals left to the examiner', () => {
  it('shows a second screen and a muted microphone on the timeline without scoring them', () => {
    const markers = buildMarkers(
      [
        ev(1, 'proctor.signal', { kind: 'second_screen', active: true }, 0),
        ev(2, 'proctor.signal', { kind: 'mic_off', active: true }, 1000),
      ],
      opts,
    )
    expect(markers.map((m) => [m.kind, m.status])).toEqual([
      ['second_screen', 'context'],
      ['mic_off', 'context'],
    ])
    expect(riskScore(markers)).toBe(0)
  })

  it('never calls the device silent about noise: it samples moments, the server whole seconds', () => {
    const control = ev(
      2,
      'evidence.fragment',
      { reason: 'control', tStart: 0, tEnd: 20_000, chunks: [], chunkStarts: [] },
      20_000,
    )
    const markers = buildMarkers([ev(1, 'proctoring.mode', { tier: 'full' }, 0), control], {
      ...opts,
      serverFindings: [{ kind: 'noise', startAt: 2000, endAt: 12_000 }],
    })
    expect(markers).toEqual([expect.objectContaining({ kind: 'noise', source: 'model', discrepancy: false })])
  })
})
