import type { DeviceTier, MarkerKind } from '@exam/contracts'
import type { Fragment } from '../ml/recordings.ts'
import type { Interval } from '../ml/observations.ts'
import type { MarkerDraft, StoredEvent } from './analysis.ts'

/**
 * What the device measures at each tier, as reliably as the server: silence about anything else is not a
 * discrepancy. Not here: noise (the device samples moments, the server averages each second, so speech
 * between pauses is heard by one only) and objects on `lite` (looked for every 10 s, the server sees 2 s).
 * Those server findings still become markers, only never "the device kept silent".
 */
const MEASURED: Record<DeviceTier, ReadonlySet<MarkerKind>> = {
  full: new Set(['face_missing', 'multiple_faces', 'object_detected']),
  lite: new Set(['face_missing', 'multiple_faces']),
  // Weak devices still check for a face, only less often (architecture 10.5).
  slow: new Set(['face_missing', 'multiple_faces']),
  minimal: new Set(), // older clients: no face check at all
  none: new Set(),
}

type Span = { startAt: number; endAt: number }
export const overlaps = (a: Span, b: Span) => a.startAt <= b.endAt && a.endAt >= b.startAt

/** True when the device reported the same kind at an overlapping time: the server confirms that signal. */
export const confirmedByDevice = (finding: Interval, markers: MarkerDraft[]) =>
  markers.some((m) => m.source === 'client' && m.kind === finding.kind && overlaps(m, finding))

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
  const tiers = events.flatMap((e) =>
    e.type === 'proctoring.mode' ? [{ at: e.clientAt, tier: (e.data as { tier: DeviceTier }).tier }] : [],
  )
  // A device that never said which tier it ran is held to the strictest one: otherwise a tampered client
  // could avoid every discrepancy just by never sending its mode.
  const measured = (kind: MarkerKind, at: number) =>
    MEASURED[tiers.findLast((t) => t.at <= at)?.tier ?? 'full'].has(kind)
  const inControl = (finding: Interval) =>
    fragments.some((f) => f.reason === 'control' && overlaps(finding, { startAt: f.tStart, endAt: f.tEnd }))

  // Darkness needs no special case here: the server already ignores frames it measured as too dark
  // (ml/observations.ts). The device's own `too_dark` signal is not trusted, since a tampered client could
  // keep it on to hide every missing face.
  return findings.map((finding) => ({
    ...finding,
    status: 'pending' as const,
    source: 'model' as const,
    discrepancy:
      !confirmedByDevice(finding, markers) && inControl(finding) && measured(finding.kind, finding.startAt),
  }))
}
