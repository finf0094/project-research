import type { RecordingMode, RiskLevel, SignalKind } from '@exam/contracts'
import type { EventLog } from '@/modules/offline'
import { createEvidence } from './evidence'
import { startRecorder, type Recorder } from './recorder'
import { createSensors } from './sensors'
import { ANALYSIS_FPS, HINTS, createSignalTracker, riskLevel, type ObservedKind } from './signals'

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

const DARK_BRIGHTNESS = 45
const NOISE_RMS = 0.08
const HINT_REPEAT_MS = 60_000
const RECENT_MS = 2 * 60_000
const RISK_FRAGMENT_MS = 30_000

/**
 * Local adaptive proctoring: measures, turns measurements into signals, shows hints, and decides
 * how much evidence to keep. It never judges; signals and fragments go into the sealed event log.
 */
export async function startProctor(stream: MediaStream, options: ProctorOptions): Promise<Proctor> {
  const { attemptId, log, recording, now } = options
  const sensors = await createSensors(stream)
  const tracker = createSignalTracker()
  const active = new Set<SignalKind>()
  const activations: number[] = []
  const lastHint = new Map<SignalKind, number>()
  let risk: RiskLevel = 'low'
  let lastRiskFragment = -Infinity
  let timer: ReturnType<typeof setTimeout> | undefined

  let recorder: Recorder | null = null
  const evidence = createEvidence(attemptId, log, () => recorder)
  recorder = startRecorder(stream, now, (chunk) => {
    if (recording === 'full') evidence.request('full', chunk.tStart, chunk.tEnd)
    evidence.onChunk()
  })

  function setSignal(kind: SignalKind, on: boolean) {
    if (on === active.has(kind)) return
    if (on) {
      active.add(kind)
      activations.push(now())
    } else {
      active.delete(kind)
    }
    void log.append('proctor.signal', { kind, active: on })
    if (on && HINTS[kind] && now() - (lastHint.get(kind) ?? -Infinity) > HINT_REPEAT_MS) {
      lastHint.set(kind, now())
      void log.append('hint.shown', { kind })
    }
    options.onHint([...active].find((k) => HINTS[k]) ?? null)
    updateRisk()
  }

  function updateRisk() {
    const recent = activations.filter((t) => now() - t < RECENT_MS).length
    const next = riskLevel(active, recent)
    if (next === risk) return
    void log.append('risk.changed', { from: risk, to: next })
    risk = next
    options.onRisk(next)
    if (next === 'high' && now() - lastRiskFragment > 2 * RISK_FRAGMENT_MS) {
      lastRiskFragment = now()
      evidence.request('risk', now() - RISK_FRAGMENT_MS, now() + RISK_FRAGMENT_MS)
    }
  }

  function observe(kind: ObservedKind, present: boolean) {
    const transition = tracker.observe(kind, present, now())
    if (transition) setSignal(transition.kind, transition.active)
  }

  function tick() {
    const faces = sensors.faces(performance.now())
    if (faces !== null) {
      observe('face_missing', faces === 0)
      observe('multiple_faces', faces >= 2)
    }
    observe('too_dark', sensors.brightness() < DARK_BRIGHTNESS)
    observe('noise', sensors.loudness() > NOISE_RMS)
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

  return {
    capture(seconds) {
      evidence.request('control', now(), now() + seconds * 1000)
    },
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
