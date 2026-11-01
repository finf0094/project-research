import type { MarkerKind, MarkerSource, MarkerStatus, SignalKind } from '@exam/contracts'
import type { Interval } from '../ml/observations.ts'
import type { Fragment } from '../ml/recordings.ts'
import { confirmedByDevice, overlaps, reconcile } from './reconcile.ts'

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
  source: MarkerSource
  discrepancy: boolean
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
  looking_away: 10,
  object_detected: 30,
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
    /** What the server's own models found in the recordings; null when that analysis did not run. */
    serverFindings?: Interval[] | null
  },
): MarkerDraft[] {
  const fragments = events.flatMap((e) => (e.type === 'evidence.fragment' ? [e.data as Fragment] : []))
  const chunksFor = (startAt: number, endAt: number) =>
    fragments
      .filter((f) => f.tStart <= endAt && f.tEnd >= startAt)
      .flatMap((f) => f.chunks.filter((c) => opts.uploaded.has(c)))

  const markers: MarkerDraft[] = []
  const add = (
    kind: MarkerKind,
    startAt: number,
    endAt: number,
    status: MarkerStatus,
    source: MarkerSource = 'client',
  ) =>
    markers.push({
      kind,
      startAt,
      endAt,
      status,
      source,
      discrepancy: false,
      chunks: chunksFor(startAt, endAt),
    })
  const system = (kind: MarkerKind, at: number) =>
    markers.push({
      kind,
      startAt: at,
      endAt: at,
      status: 'pending',
      source: 'server',
      discrepancy: false,
      chunks: [],
    })

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
    system('chain_broken', at)
  }
  for (const f of fragments) {
    if (f.chunks.some((c) => !opts.uploaded.has(c)))
      add('missing_fragment', f.tStart, f.tEnd, 'pending', 'server')
  }
  for (const requestedAt of opts.captureRequests ?? []) {
    const answered = fragments.some(
      (f) =>
        f.reason === 'control' &&
        f.tStart >= requestedAt - 60_000 &&
        f.tStart <= requestedAt + CONTROL_ANSWER_WINDOW_MS,
    )
    if (!answered) system('missing_fragment', requestedAt)
  }

  const fromModels = reconcile(opts.serverFindings ?? [], markers, events, fragments)
  markers.push(...fromModels.map((f) => ({ ...f, chunks: chunksFor(f.startAt, f.endAt) })))
  return markers.sort((a, b) => a.startAt - b.startAt)
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
  const episodes: { findings: MarkerDraft[]; reported: Set<MarkerDraft> }[] = []
  for (const finding of confirming) {
    const reported = counted.filter(
      (d) => d.source === 'client' && d.kind === finding.kind && overlaps(d, finding),
    )
    const linked = episodes.filter((e) => reported.some((d) => e.reported.has(d)))
    const merged = {
      findings: [finding, ...linked.flatMap((e) => e.findings)],
      reported: new Set([...reported, ...linked.flatMap((e) => [...e.reported])]),
    }
    episodes.splice(0, episodes.length, ...episodes.filter((e) => !linked.includes(e)), merged)
  }
  const sum = (list: Iterable<MarkerDraft>) => [...list].reduce((total, m) => total + points(m), 0)
  for (const e of episodes) score += Math.max(0, sum(e.findings) - sum(e.reported))
  return Math.min(100, Math.round(score))
}
