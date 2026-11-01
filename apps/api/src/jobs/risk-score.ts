import type { MarkerKind } from '@exam/contracts'
import type { MarkerDraft } from './analysis.ts'
import { confirmedByDevice, overlaps } from './reconcile.ts'

/** Weight per minute of an open signal; the score only orders the review queue. */
const WEIGHTS: Partial<Record<MarkerKind, number>> = {
  multiple_faces: 30,
  face_missing: 15,
  tab_hidden: 20,
  paste: 15,
  camera_off: 15,
  looking_away: 10,
  off_center: 10,
  copy: 15,
  object_detected: 30,
  virtual_camera: 30,
  page_closed: 15,
  noise: 10,
  chain_broken: 40,
  missing_fragment: 20,
}

/** `calibration`: per-kind factors from the examiner's past decisions (section 25.4), 1 when unknown. */
export function riskScore(
  markers: MarkerDraft[],
  calibration: Partial<Record<MarkerKind, number>> = {},
): number {
  const points = (m: MarkerDraft) => {
    const minutes = Math.max((m.endAt - m.startAt) / 60_000, 0.25)
    const weight = (WEIGHTS[m.kind] ?? 0) * (calibration[m.kind] ?? 1)
    return weight * Math.min(minutes, 3) * (m.discrepancy ? 2 : 1)
  }
  const counted = markers.filter((m) => m.status !== 'context')
  // Server findings the device also reported confirm it. Each episode (findings and the device markers
  // they overlap, linked through shared markers) counts as the larger of its two sums: never twice, never
  // less than either alone, and one episode never cancels another.
  const confirming = counted.filter((m) => m.source === 'model' && confirmedByDevice(m, counted))
  let score = counted.filter((m) => !confirming.includes(m)).reduce((sum, m) => sum + points(m), 0)
  let episodes: { findings: MarkerDraft[]; reported: Set<MarkerDraft> }[] = []
  for (const finding of confirming) {
    const reported = counted.filter(
      (d) => d.source === 'client' && d.kind === finding.kind && overlaps(d, finding),
    )
    const linked = episodes.filter((e) => reported.some((d) => e.reported.has(d)))
    const merged = {
      findings: [finding, ...linked.flatMap((e) => e.findings)],
      reported: new Set([...reported, ...linked.flatMap((e) => [...e.reported])]),
    }
    episodes = [...episodes.filter((e) => !linked.includes(e)), merged]
  }
  const sum = (list: Iterable<MarkerDraft>) => [...list].reduce((total, m) => total + points(m), 0)
  for (const e of episodes) score += Math.max(0, sum(e.findings) - sum(e.reported))
  return Math.min(100, Math.round(score))
}
