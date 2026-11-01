import type { Marker, MarkerKind } from '@exam/contracts'

/** Markers of one kind: shown as one row with a count, judged one by one or all at once. */
export interface MarkerGroup {
  kind: MarkerKind
  markers: Marker[]
  /** Still to look at: what "confirm all" and "dismiss all" act on. */
  pending: string[]
  important: boolean
}

/** Groups markers by kind, in the order each kind first happened; each group keeps its markers' order. */
export function groupMarkers(markers: Marker[]): MarkerGroup[] {
  const groups = new Map<MarkerKind, MarkerGroup>()
  for (const m of markers) {
    const group = groups.get(m.kind) ?? { kind: m.kind, markers: [], pending: [], important: false }
    group.markers.push(m)
    if (m.status === 'pending') group.pending.push(m.id)
    group.important ||= m.discrepancy
    groups.set(m.kind, group)
  }
  return [...groups.values()]
}

/**
 * Judges the markers one after another (the server takes one marker per request) and stops at the first
 * failure, so what went through stays judged and the rest stays pending.
 */
export async function judgeEach<S>(
  ids: string[],
  status: S,
  judge: (id: string, status: S) => Promise<unknown>,
) {
  for (const id of ids) await judge(id, status)
}
