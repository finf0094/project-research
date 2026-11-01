import type { DeviceTier, RecordingMode, RiskLevel, SignalKind } from '@exam/contracts'
import type { EventLog } from '@/modules/offline'
import type { Pose } from './calibration'
import { UNMEASURED, createTierWatch, lowerTier } from './device-tier'
import { createEvidence } from './evidence'
import { createHinter } from './hints'
import { startRecorder } from './recorder'
import { createSensors } from './sensors'
import {
  ANALYSIS_FPS,
  DARK_BRIGHTNESS,
  NOISE_RMS,
  createSignalTracker,
  riskLevel,
  type ObservedKind,
} from './signals'

export interface ProctorOptions {
  attemptId: string
  log: EventLog
  recording: RecordingMode
  /** Watch the noise level (off for oral exams). */
  listen: boolean
  /** Signals not watched for this student (an individual exception, section 25.3): never raised. */
  ignore: SignalKind[]
  tier: DeviceTier
  /** Neutral head pose from preflight calibration. */
  baseline: Pose
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

const RECENT_MS = 2 * 60_000
/** Evidence kept around a risky moment: short at medium risk, longer at high risk (review, section 10.1). */
const FRAGMENT_MS: Record<'medium' | 'high', number> = { medium: 10_000, high: 30_000 }
const FRAGMENT_COOLDOWN_MS = 60_000
/** The server asks for control fragments; offline it cannot, so the client takes one itself after this long. */
const SELF_CONTROL_AFTER_MS = 15 * 60_000
const CONTROL_SECONDS = 20
/** Object detection is the heaviest model: run it every few seconds only. */
const OBJECTS_EVERY_MS = 2000
/**
 * Local adaptive proctoring: measures, turns measurements into signals, shows hints, and decides how much
 * evidence to keep. It never judges; signals and fragments go into the sealed event log.
 */
export async function startProctor(stream: MediaStream, options: ProctorOptions): Promise<Proctor> {
  const { attemptId, log, recording, now } = options
  let tier = options.tier
  const sensors = await createSensors(stream, tier, options.baseline)
  const tracker = createSignalTracker()
  const active = new Set<SignalKind>()
  let activations: number[] = []
  const hints = createHinter(log, now, options.onHint)
  let risk: RiskLevel = 'low'
  let lastFragment = -Infinity
  let lastControl = now()
  let lastObjects = -Infinity
  const tooSlow = createTierWatch()
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  const evidence = createEvidence(attemptId, log)
  let savingChunk: Promise<void> = Promise.resolve()
  const recorder = startRecorder(stream, now, (chunk) => {
    savingChunk = savingChunk.then(() => evidence.onChunk(chunk))
    if (recording === 'full') void evidence.request('full', chunk.tStart, chunk.tEnd)
  })
  void log.append('proctoring.mode', { tier })

  const showHint = () => hints.show(active)

  // Signals the examiner switched off for this student (section 25.3): no hint, no event, no risk.
  const ignored = new Set<SignalKind>(options.ignore)
  function setSignal(kind: SignalKind, on: boolean) {
    if (ignored.has(kind) || on === active.has(kind)) return
    if (on) {
      active.add(kind)
      activations.push(now())
    } else {
      active.delete(kind)
    }
    if (kind === 'tab_hidden' && !on) hints.returned()
    void log.append('proctor.signal', { kind, active: on })
    showHint()
    updateRisk()
  }

  function updateRisk() {
    activations = activations.filter((t) => now() - t < RECENT_MS)
    const next = riskLevel(active, activations.length)
    if (next === risk) return
    void log.append('risk.changed', { from: risk, to: next })
    const previous = risk
    risk = next
    options.onRisk(next)
    // Evidence is kept when risk rises. With full recording every chunk is already kept, so it is skipped.
    const rising = next === 'high' || (next === 'medium' && previous === 'low')
    // High risk always gets its long fragment, even right after a medium one.
    const cooledDown = next === 'high' || now() - lastFragment > FRAGMENT_COOLDOWN_MS
    if (next !== 'low' && rising && recording !== 'full' && cooledDown) {
      lastFragment = now()
      void evidence.request('risk', now() - FRAGMENT_MS[next], now() + FRAGMENT_MS[next])
    }
  }

  function observe(kind: ObservedKind, present: boolean) {
    const transition = tracker.observe(kind, present, now())
    if (transition) setSignal(transition.kind, transition.active)
  }

  async function analyze() {
    const withObjects = tier === 'full' && now() - lastObjects > OBJECTS_EVERY_MS
    if (withObjects) lastObjects = now()
    const frame = await sensors.analyze(withObjects)
    if (stopped) return
    if (options.listen) observe('noise', sensors.loudness() > NOISE_RMS)
    if (!frame) return
    const dark = frame.brightness < DARK_BRIGHTNESS
    observe('too_dark', dark)
    if (frame.faces != null) {
      // In the dark the detector misses faces; that is the room's fault, not the student's behaviour.
      observe('face_missing', frame.faces === 0 && !dark)
      observe('multiple_faces', frame.faces >= 2)
    }
    if (frame.lookingAway != null) observe('looking_away', frame.lookingAway)
    if (frame.object != null) observe('object_detected', frame.object)
    adaptTier(frame.ms)
  }

  /** Keeps the exam smooth on weak computers: lowers the tier when analysis is consistently slow. */
  function adaptTier(ms: number) {
    if (tier === 'minimal' || !tooSlow(ms)) return
    tier = lowerTier(tier)
    sensors.lower(tier)
    void log.append('proctoring.mode', { tier })
    for (const kind of UNMEASURED[tier]) {
      tracker.reset(kind)
      setSignal(kind, false)
    }
  }

  /** One step per frame: the next one is scheduled only after this frame's analysis came back. */
  async function tick() {
    await analyze().catch((error: unknown) => console.error('frame analysis failed', error))
    if (stopped) return
    updateRisk()
    showHint()
    if (now() - lastControl > SELF_CONTROL_AFTER_MS) capture(CONTROL_SECONDS)
    timer = setTimeout(tick, 1000 / ANALYSIS_FPS[tier === 'minimal' ? 'low' : risk])
  }

  function capture(seconds: number) {
    lastControl = now()
    void evidence.request('control', now(), now() + seconds * 1000)
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
  void tick()

  return {
    capture,
    async stop() {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('paste', onPaste)
      await recorder.stop()
      await savingChunk
      await evidence.finish()
      sensors.dispose()
    },
  }
}
