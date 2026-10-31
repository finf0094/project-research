import type { RecordingMode, RiskLevel, SignalKind } from '@exam/contracts'
import type { EventLog } from '@/modules/offline'
import { createEvidence } from './evidence'
import { startRecorder, type Recorder } from './recorder'
import { createSensors } from './sensors'
import {
  ANALYSIS_FPS,
  DARK_BRIGHTNESS,
  HINTS,
  NOISE_RMS,
  createSignalTracker,
  riskLevel,
  type ObservedKind,
} from './signals'

export interface ProctorOptions {
  attemptId: string
  log: EventLog
  recording: RecordingMode
  /** Server-time clock of the attempt; signal and fragment times use it. */
  now: () => number
  onHint(kind: SignalKind | null): void
  onRisk(level: RiskLevel): void
}

export interface Proctor {
  /** Records a control fragment of the next `seconds` (requested by the server). */
  capture(seconds: number): void
  stop(): Promise<void>
}

const HINT_REPEAT_MS = 60_000
/** The "stay on the tab" hint is only visible after the student comes back, so it lingers a little. */
const RETURN_HINT_MS = 10_000
const RECENT_MS = 2 * 60_000
const RISK_FRAGMENT_MS = 30_000
/**
 * The server asks for control fragments at random moments. Without network it cannot, so the client
 * takes one itself when none was taken for this long (the server reconciles both kinds after the exam).
 */
const SELF_CONTROL_AFTER_MS = 15 * 60_000
const CONTROL_SECONDS = 20

/**
 * Local adaptive proctoring: measures, turns measurements into signals, shows hints, and decides
 * how much evidence to keep. It never judges; signals and fragments go into the sealed event log.
 */
export async function startProctor(stream: MediaStream, options: ProctorOptions): Promise<Proctor> {
  const { attemptId, log, recording, now } = options
  const sensors = await createSensors(stream)
  const tracker = createSignalTracker()
  const active = new Set<SignalKind>()
  let activations: number[] = []
  const lastHint = new Map<SignalKind, number>()
  let returnHintUntil = 0
  let risk: RiskLevel = 'low'
  let lastRiskFragment = -Infinity
  let lastControl = now()
  let timer: ReturnType<typeof setTimeout> | undefined

  let recorder: Recorder | null = null
  const evidence = createEvidence(attemptId, log, () => recorder)
  recorder = startRecorder(stream, now, (chunk) => {
    if (recording === 'full') evidence.request('full', chunk.tStart, chunk.tEnd)
    evidence.onChunk()
  })

  /** Shows the hint for the first active signal (or the lingering tab hint) and logs it once a minute per kind. */
  function showHint() {
    const kind: SignalKind | null =
      [...active].find((k) => HINTS[k]) ?? (now() < returnHintUntil ? 'tab_hidden' : null)
    options.onHint(kind)
    if (
      kind &&
      document.visibilityState === 'visible' &&
      now() - (lastHint.get(kind) ?? -Infinity) > HINT_REPEAT_MS
    ) {
      lastHint.set(kind, now())
      void log.append('hint.shown', { kind })
    }
  }

  function setSignal(kind: SignalKind, on: boolean) {
    if (on === active.has(kind)) return
    if (on) {
      active.add(kind)
      activations.push(now())
    } else {
      active.delete(kind)
    }
    if (kind === 'tab_hidden' && !on) returnHintUntil = now() + RETURN_HINT_MS
    void log.append('proctor.signal', { kind, active: on })
    showHint()
    updateRisk()
  }

  function updateRisk() {
    activations = activations.filter((t) => now() - t < RECENT_MS)
    const next = riskLevel(active, activations.length)
    if (next === risk) return
    void log.append('risk.changed', { from: risk, to: next })
    risk = next
    options.onRisk(next)
    // With full recording every chunk is already kept; a risk fragment would only upload them twice.
    if (next === 'high' && recording !== 'full' && now() - lastRiskFragment > 2 * RISK_FRAGMENT_MS) {
      lastRiskFragment = now()
      evidence.request('risk', now() - RISK_FRAGMENT_MS, now() + RISK_FRAGMENT_MS)
    }
  }

  function observe(kind: ObservedKind, present: boolean) {
    const transition = tracker.observe(kind, present, now())
    if (transition) setSignal(transition.kind, transition.active)
  }

  function tick() {
    const dark = sensors.brightness() < DARK_BRIGHTNESS
    observe('too_dark', dark)
    const faces = sensors.faces(performance.now())
    if (faces !== null) {
      // In the dark the detector misses faces; that is the room's fault, not the student's behaviour.
      observe('face_missing', faces === 0 && !dark)
      observe('multiple_faces', faces >= 2)
    }
    observe('noise', sensors.loudness() > NOISE_RMS)
    updateRisk()
    showHint()
    if (now() - lastControl > SELF_CONTROL_AFTER_MS) capture(CONTROL_SECONDS)
    timer = setTimeout(tick, 1000 / ANALYSIS_FPS[risk])
  }

  const onVisibility = () => setSignal('tab_hidden', document.visibilityState === 'hidden')
  const onPaste = (event: ClipboardEvent) => {
    // Only substantial pastes matter; moving a word around is normal editing.
    if ((event.clipboardData?.getData('text') ?? '').length < 20) return
    setSignal('paste', true)
    setSignal('paste', false)
  }
  document.addEventListener('visibilitychange', onVisibility)
  document.addEventListener('paste', onPaste)
  tick()

  function capture(seconds: number) {
    lastControl = now()
    evidence.request('control', now(), now() + seconds * 1000)
  }

  return {
    capture,
    async stop() {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('paste', onPaste)
      await recorder?.stop()
      await evidence.finish()
      sensors.dispose()
    },
  }
}
