import type { ExamMode, MarkerKind, MarkerSource, MarkerStatus, SignalKind } from '@exam/contracts'
import type { Interval } from '../ml/observations.ts'
import type { Fragment } from '../ml/recordings.ts'
import { reconcile } from './reconcile.ts'

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

/**
 * Signals that describe the environment, not behaviour; they explain the timeline but are never scored.
 * A second screen, a muted microphone or headphones are left to the examiner: a monitor connected all
 * exam would otherwise outweigh everything else, and headphones may be the student's hearing aid.
 */
const CONTEXT_SIGNALS: ReadonlySet<SignalKind> = new Set([
  'too_dark',
  'second_screen',
  'mic_off',
  'headphones',
])

/** The server's findings that mean something in this kind of exam: in an oral one the student talks throughout. */
export const findingsFor = (findings: Interval[], mode: ExamMode) =>
  mode === 'oral' ? findings.filter((f) => f.kind !== 'noise') : findings

/** A reopened page counts as closed only past this (a double start of the same page is not a reload). */
const PAGE_CLOSED_MIN_MS = 2000

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
    /** During the exam: uploads are still on their way, so a chunk not here yet is not "missing". */
    live?: boolean
    /** Signals not watched for this student (section 25.3): ignored, so they shape no other marker either. */
    disabled?: ReadonlySet<string>
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
  const close = (kind: SignalKind, since: number, at: number) => {
    add(kind, since, at, CONTEXT_SIGNALS.has(kind) ? 'context' : 'pending')
    openSignals.delete(kind)
  }
  /** Ends every open signal at `at`, never before it started. */
  const closeAll = (at: number) => {
    for (const [kind, since] of openSignals) close(kind, since, Math.max(since, at))
  }
  let offlineSince: number | null = null
  let previousAt: number | null = null
  for (const e of events) {
    if (e.type === 'session.resumed' && previousAt !== null) {
      // The page was closed or reloaded. The reopened page starts its signals and its network state
      // afresh, so the old ones end where the old page was last seen.
      const hiddenAt = openSignals.get('tab_hidden')
      const leftAt = Math.min(hiddenAt ?? previousAt, e.clientAt)
      // Leaving the tab that closed the page is the page_closed marker itself, not a second one.
      openSignals.delete('tab_hidden')
      closeAll(leftAt)
      if (offlineSince !== null) add('offline', offlineSince, Math.max(offlineSince, leftAt), 'context')
      offlineSince = null
      // From the tab being left until the page came back. A leaving that was not recorded (the page often
      // closes before it is written) only lies somewhere after the last event, which may be many quiet
      // minutes back: the marker is then the moment the page came back, not an absence that never was.
      if (e.clientAt - leftAt >= PAGE_CLOSED_MIN_MS)
        add('page_closed', hiddenAt === undefined ? e.clientAt : leftAt, e.clientAt, 'pending')
    }
    previousAt = e.clientAt
    if (e.type === 'proctor.signal') {
      const { kind, active } = e.data as { kind: SignalKind; active: boolean }
      // E.g. an allowed tab switch must not turn a later reload into a page closed all that time.
      if (opts.disabled?.has(kind)) continue
      const since = openSignals.get(kind)
      if (active && since === undefined) openSignals.set(kind, e.clientAt)
      if (!active && since !== undefined) close(kind, since, e.clientAt)
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
  closeAll(opts.endAt) // signals still open at the end last until the attempt ended
  if (offlineSince !== null) add('offline', offlineSince, Math.max(offlineSince, opts.endAt), 'context')

  if (opts.chainBrokenAt !== null) {
    const at = events.at(-1)?.clientAt ?? opts.endAt
    system('chain_broken', at)
  }
  for (const f of opts.live ? [] : fragments) {
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
