import type { MarkerKind, MarkerStatus, SignalKind } from '@exam/contracts'

export interface StoredEvent {
  seq: number
  type: string
  data: unknown
  clientAt: number
}

export interface MarkerDraft {
  kind: MarkerKind
  startAt: number
  endAt: number
  status: MarkerStatus
  chunks: string[]
}

/** Signals that describe the environment, not behaviour; they explain the timeline but are never violations. */
const CONTEXT_SIGNALS: ReadonlySet<SignalKind> = new Set(['too_dark'])

/** Weight per minute of an open signal; the score only orders the review queue. */
const WEIGHTS: Partial<Record<MarkerKind, number>> = {
  multiple_faces: 30,
  face_missing: 15,
  tab_hidden: 20,
  paste: 15,
  camera_off: 15,
  noise: 10,
  chain_broken: 40,
  missing_fragment: 20,
}

/** A control fragment counts as answering a request if it starts within this window after it. */
const CONTROL_ANSWER_WINDOW_MS = 10 * 60_000

/**
 * Turns the event log into timeline markers:
 * - paired proctor.signal on/off events become intervals (an unclosed signal lasts until `endAt`);
 * - offline periods become context markers;
 * - a broken chain, chunks that never arrived, and control fragments the server asked for but never got
 *   become markers of their own (the last one is how disabled client-side recording shows up).
 */
export function buildMarkers(
  events: StoredEvent[],
  opts: {
    endAt: number
    uploaded: ReadonlySet<string>
    chainBrokenAt: number | null
    captureRequests?: number[]
  },
): MarkerDraft[] {
  const fragments = events.flatMap((e) =>
    e.type === 'evidence.fragment'
      ? [e.data as { reason: string; tStart: number; tEnd: number; chunks: string[] }]
      : [],
  )
  const chunksFor = (startAt: number, endAt: number) =>
    fragments
      .filter((f) => f.tStart <= endAt && f.tEnd >= startAt)
      .flatMap((f) => f.chunks.filter((c) => opts.uploaded.has(c)))

  const markers: MarkerDraft[] = []
  const add = (kind: MarkerKind, startAt: number, endAt: number, status: MarkerStatus) =>
    markers.push({ kind, startAt, endAt, status, chunks: chunksFor(startAt, endAt) })

  const openSignals = new Map<SignalKind, number>()
  let offlineSince: number | null = null
  for (const e of events) {
    if (e.type === 'proctor.signal') {
      const { kind, active } = e.data as { kind: SignalKind; active: boolean }
      const since = openSignals.get(kind)
      if (active && since === undefined) openSignals.set(kind, e.clientAt)
      if (!active && since !== undefined) {
        add(kind, since, e.clientAt, CONTEXT_SIGNALS.has(kind) ? 'context' : 'pending')
        openSignals.delete(kind)
      }
    }
    if (e.type === 'network.changed') {
      const { to } = e.data as { to: string }
      if (to === 'offline' && offlineSince === null) offlineSince = e.clientAt
      if (to !== 'offline' && offlineSince !== null) {
        add('offline', offlineSince, e.clientAt, 'context')
        offlineSince = null
      }
    }
  }
  // Signals still open at the end last until the attempt ended (never before they started).
  for (const [kind, since] of openSignals) {
    add(kind, since, Math.max(since, opts.endAt), CONTEXT_SIGNALS.has(kind) ? 'context' : 'pending')
  }
  if (offlineSince !== null) add('offline', offlineSince, Math.max(offlineSince, opts.endAt), 'context')

  if (opts.chainBrokenAt !== null) {
    const at = events.at(-1)?.clientAt ?? opts.endAt
    markers.push({ kind: 'chain_broken', startAt: at, endAt: at, status: 'pending', chunks: [] })
  }
  for (const f of fragments) {
    if (f.chunks.some((c) => !opts.uploaded.has(c))) add('missing_fragment', f.tStart, f.tEnd, 'pending')
  }
  for (const requestedAt of opts.captureRequests ?? []) {
    const answered = fragments.some(
      (f) =>
        f.reason === 'control' &&
        f.tStart >= requestedAt - 60_000 &&
        f.tStart <= requestedAt + CONTROL_ANSWER_WINDOW_MS,
    )
    if (!answered)
      markers.push({
        kind: 'missing_fragment',
        startAt: requestedAt,
        endAt: requestedAt,
        status: 'pending',
        chunks: [],
      })
  }
  return markers.sort((a, b) => a.startAt - b.startAt)
}

export function riskScore(markers: MarkerDraft[]): number {
  let score = 0
  for (const m of markers) {
    if (m.status === 'context') continue
    const minutes = Math.max((m.endAt - m.startAt) / 60_000, 0.25)
    score += (WEIGHTS[m.kind] ?? 0) * Math.min(minutes, 3)
  }
  return Math.min(100, Math.round(score))
}
