import type { DeviceTier, MarkerKind } from '@exam/contracts'
import type { Interval } from '../ml/observations.ts'
import type { Fragment, MarkerDraft, StoredEvent } from './analysis.ts'

/** What the device measures at each tier: silence about anything else is not a discrepancy. */
const MEASURED: Record<DeviceTier, ReadonlySet<MarkerKind>> = {
  full: new Set(['face_missing', 'multiple_faces', 'object_detected']),
  lite: new Set(['face_missing', 'multiple_faces']),
  minimal: new Set(),
}

type Span = { startAt: number; endAt: number }
const overlaps = (a: Span, b: Span) => a.startAt <= b.endAt && a.endAt >= b.startAt

/**
 * Reconciliation (architecture, section 17.4): the server's finding is a second opinion. When the device
 * reported the same thing it confirms it. When the device stayed silent although it was measuring that
 * kind, inside a control fragment (a random sample the student could not predict), it is a discrepancy:
 * the strongest hint that client-side proctoring was tampered with.
 * Returns the model markers (without chunks) for the findings worth showing.
 */
export function reconcile(
  findings: Interval[],
  markers: MarkerDraft[],
  events: StoredEvent[],
  fragments: Fragment[],
): Omit<MarkerDraft, 'chunks'>[] {
  const fromDevice = markers.filter((m) => m.source === 'client')
  const tiers = events.flatMap((e) =>
    e.type === 'proctoring.mode' ? [{ at: e.clientAt, tier: (e.data as { tier: DeviceTier }).tier }] : [],
  )
  const measured = (kind: MarkerKind, at: number) => {
    const tier = tiers.findLast((t) => t.at <= at)?.tier
    return tier !== undefined && MEASURED[tier].has(kind)
  }
  const inControl = (finding: Interval) =>
    fragments.some((f) => f.reason === 'control' && overlaps(finding, { startAt: f.tStart, endAt: f.tEnd }))

  return findings.flatMap((finding) => {
    const dark = fromDevice.some((m) => m.kind === 'too_dark' && overlaps(m, finding))
    // The detector misses faces in the dark too; the device does not count that, and neither does the server.
    if (finding.kind === 'face_missing' && dark) return []
    const confirmed = fromDevice.some((m) => m.kind === finding.kind && overlaps(m, finding))
    return [
      {
        ...finding,
        status: 'pending' as const,
        source: 'model' as const,
        discrepancy: !confirmed && inControl(finding) && measured(finding.kind, finding.startAt),
      },
    ]
  })
}
