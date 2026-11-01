import type { DeviceTier, RecordingMode, RiskLevel, SignalKind } from '@exam/contracts'
import type { EventLog } from '@/modules/offline'
import type { Pose } from './calibration'
import { UNMEASURED, createTierWatch, lowerTier } from './device-tier'
import { createEvidence } from './evidence'
import { watchDevices, watchMicrophone } from './devices'
import { createHinter } from './hints'
import { startRecorder, type Recorder } from './recorder'
import { createSensors } from './sensors'
import {
  ANALYSIS_FPS,
  createSignalTracker,
  noiseThreshold,
  objectsEvery,
  observeFrame,
  riskLevel,
  watchBrowser,
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
  /** The room's quiet level from preflight (null: not measured on this device). */
  noiseFloor: number | null
  /** Server-time clock of the attempt; signal and fragment times use it. */
  now: () => number
  onHint(kind: SignalKind | null): void
  onRisk(level: RiskLevel): void
  /** A signal turned on: the caller sends the log now (the server marks it within seconds). */
  onSignal?(): void
}

export interface Proctor {
  /** Records a control fragment of the next `seconds` (requested by the server). */
  capture(seconds: number): void
  /** Ends proctoring; `discard` (a start the caller gave up on) leaves the attempt's recording alone. */
  stop(discard?: boolean): Promise<void>
}

const RECENT_MS = 2 * 60_000
/** Evidence kept around a risky moment: short at medium risk, longer at high risk (review, section 10.1). */
const FRAGMENT_MS: Record<'medium' | 'high', number> = { medium: 10_000, high: 30_000 }
const FRAGMENT_COOLDOWN_MS = 60_000
/** The weakest devices check the face this often (architecture 10.5: every 2–3 s), never not at all. */
const SLOW_EVERY_MS = 2500
/** Offline the server cannot ask for control fragments, so the client takes one after a random 10-20 min. */
const selfControlDelay = () => (10 + Math.random() * 10) * 60_000
const CONTROL_SECONDS = 20
/**
 * Local adaptive proctoring: measures, turns measurements into signals, shows hints, and decides how much
 * evidence to keep. It never judges; signals and fragments go into the sealed event log.
 */
export async function startProctor(stream: MediaStream, options: ProctorOptions): Promise<Proctor> {
  const { attemptId, log, recording, now } = options
  let tier = options.tier
  const sensors = await createSensors(stream, tier, options.baseline)
  const tracker = createSignalTracker()
  const noiseLevel = noiseThreshold(options.noiseFloor)
  const active = new Set<SignalKind>()
  let activations: number[] = []
  const hints = createHinter(log, now, options.onHint)
  let risk: RiskLevel = 'low'
  let lastFragment = -Infinity
  let controlDue = now() + selfControlDelay()
  let lastObjects = -Infinity
  const tooSlow = createTierWatch()
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  let discarded = false
  let blind = false

  // A pinned fragment goes up at once too: the server's models look at it during the exam.
  const evidence = createEvidence(attemptId, log, () => options.onSignal?.())
  // Without a recorder (a browser that cannot record) the exam is still watched: the camera stays on,
  // signals and hints work; the server marks the missing recording on its own.
  let recorder: Recorder = { stop: async () => undefined }
  try {
    // Evidence runs everything through one queue, so a full-recording request always follows its chunk.
    recorder = startRecorder(stream, now, (chunk) => {
      if (discarded) return
      void evidence.onChunk(chunk)
      if (recording === 'full') void evidence.request('full', chunk.tStart, chunk.tEnd)
    })
  } catch (error) {
    console.error('this browser cannot record the camera; watching without a recording', error)
  }
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
    // A new signal goes to the server at once (once it is in the log), not with the next periodic sync.
    void log.append('proctor.signal', { kind, active: on }).then(() => on && options.onSignal?.())
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
    const withObjects = now() - lastObjects > objectsEvery(tier)
    if (withObjects) lastObjects = now()
    const frame = await sensors.analyze(withObjects)
    if (stopped) return
    if (options.listen) observe('noise', sensors.loudness() > noiseLevel)
    if (sensors.dead()) {
      // A dead detector worker sees nothing more, brightness included: recorded as analysing nothing.
      if (!blind) dropTier('none', [...UNMEASURED.none, 'too_dark'])
      blind = true
      return
    }
    if (!frame) return
    observeFrame(frame, tier, observe)
    // Keeps the exam smooth on weak computers: lowers the tier when analysis is consistently slow.
    if (tier === 'slow' || tier === 'none' || !tooSlow(frame.ms)) return
    sensors.lower(lowerTier(tier))
    dropTier(lowerTier(tier), UNMEASURED[lowerTier(tier)])
  }

  /** Records the new tier and switches off what it no longer measures, so nothing stays stuck on. */
  function dropTier(next: DeviceTier, unmeasured: ObservedKind[]) {
    tier = next
    void log.append('proctoring.mode', { tier })
    for (const kind of unmeasured) {
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
    if (now() > controlDue) capture(CONTROL_SECONDS)
    timer = setTimeout(tick, tier === 'slow' ? SLOW_EVERY_MS : 1000 / ANALYSIS_FPS[risk])
  }

  function capture(seconds: number) {
    controlDue = now() + selfControlDelay()
    void evidence.request('control', now(), now() + seconds * 1000)
  }

  const stops = [watchBrowser(setSignal), watchMicrophone(stream, setSignal), watchDevices(stream, setSignal)]
  void tick()

  return {
    capture,
    async stop(discard = false) {
      stopped = true
      discarded = discard
      clearTimeout(timer)
      for (const unwatch of stops) unwatch()
      await recorder.stop()
      if (!discard) await evidence.finish()
      sensors.dispose()
    },
  }
}
