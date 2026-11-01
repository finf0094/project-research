import type { RecordingMode, RiskLevel, SignalKind } from '@exam/contracts'
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { EventLog } from '@/modules/offline'
import { cameraProblem, stopTracks, type CameraProblem } from '@/shared/lib/media'
import { savedBaseline, savedNoiseFloor } from './calibration'
import { savedTier } from './device-tier'
import { abortable, silencedOnAbort } from './abortable'
import { startProctor, type Proctor } from './proctor'
import { requestCamera } from './sensors'

export type CameraState = 'off' | 'starting' | 'on' | 'blocked'
/** A camera ended by the system is asked for again by itself at most this often (no loop on a broken one). */
const AUTO_RESTART_MS = 30_000

export interface StartOptions {
  attemptId: string
  log: EventLog
  recording: RecordingMode
  /** Watch the noise level; off for oral exams, where the student talks the whole time. */
  listen: boolean
  /** Signals not watched for this student (an individual exception, section 25.3). */
  ignore: SignalKind[]
  now: () => number
  /** A signal turned on: the log goes to the server now. */
  onSignal?: () => void
}

interface Running {
  attemptId: string
  proctor: Proctor
  media: MediaStream
}

/**
 * Camera state and the current hint for the exam screen.
 * Start and stop run strictly one after another (a promise queue), so their events land in the chain in order;
 * a start still waiting for the camera prompt is aborted by stop() instead of blocking it.
 */
export const useProctoringStore = defineStore('proctoring', () => {
  const stream = shallowRef<MediaStream | null>(null)
  const camera = ref<CameraState>('off')
  /** Why the camera is off, for the advice next to "Turn on the camera". */
  const problem = ref<CameraProblem | null>(null)
  /** The browser's own words for an unexpected failure: shown small, so a screenshot tells the cause. */
  const problemDetail = ref('')
  const hint = ref<SignalKind | null>(null)
  const risk = ref<RiskLevel>('low')
  const recording = ref<RecordingMode>('adaptive')

  let lifecycle: Promise<void> = Promise.resolve()
  let running: Running | null = null
  let launching: AbortController | null = null
  let options: StartOptions | null = null
  /** Whether the chain currently says the camera is off (per attempt), so changes are recorded once. */
  let cameraOff = false
  let lastAutoRestart = -Infinity
  let stops = 0 // bumped by stop(): a restart queued before it must not open the camera again

  const enqueue = (operation: () => Promise<void>) =>
    (lifecycle = lifecycle.then(operation).catch((error) => console.error('proctoring', error)))

  function start(next: StartOptions): Promise<void> {
    return enqueue(async () => {
      if (running?.attemptId === next.attemptId) return
      if (running) await shutdown()
      if (options?.attemptId !== next.attemptId) cameraOff = false
      options = next
      recording.value = next.recording
      await launch(next)
    })
  }

  async function launch(opts: StartOptions) {
    const abort = new AbortController()
    launching = abort
    camera.value = 'starting'
    problem.value = null
    problemDetail.value = ''
    let media: MediaStream | null = null
    try {
      media = await abortable(requestCamera(), abort.signal, (m) => stopTracks(m))
      if (!media) return
      // The student sees themselves at once; the models load meanwhile (seconds on a phone).
      stream.value = media
      camera.value = 'on'
      const proctor = await abortable(
        startProctor(media, {
          ...opts,
          // A start given up on may finish after this attempt was opened again: it must not add to its chain.
          log: silencedOnAbort(opts.log, abort.signal),
          tier: savedTier(),
          baseline: savedBaseline(),
          noiseFloor: savedNoiseFloor(),
          onHint: (kind) => (hint.value = kind),
          onRisk: (level) => (risk.value = level),
        }),
        abort.signal,
        (p) => void p.stop(true),
      )
      if (!proctor) return release(media)

      running = { attemptId: opts.attemptId, proctor, media }
      if (cameraOff) await recordCamera(opts, false)
      // A camera that dies mid-exam (unplugged, taken by another app) is recorded and shown at once.
      // A phone may end it for a moment (a call, another app): it is asked for again once by itself.
      for (const track of media.getTracks()) {
        track.addEventListener('ended', () => {
          const stopsBefore = stops
          return enqueue(async () => {
            if (running?.proctor !== proctor) return
            await shutdown()
            await cameraLost(opts)
            const due = Date.now() - lastAutoRestart > AUTO_RESTART_MS && stops === stopsBefore
            if (due && document.visibilityState === 'visible') {
              lastAutoRestart = Date.now()
              await launch(opts)
            }
          })
        })
      }
    } catch (error) {
      console.error('proctoring could not start', error)
      problem.value = cameraProblem(error)
      problemDetail.value =
        error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 160) : String(error)
      // Whatever was acquired is released, so the camera light goes off and a retry does not open a second one.
      if (running?.media !== media) release(media)
      if (!abort.signal.aborted) await cameraLost(opts)
    } finally {
      if (launching === abort) launching = null
      if (camera.value === 'starting') camera.value = 'off'
    }
  }

  /** A camera shown but never handed to a running proctor goes off again. */
  function release(media: MediaStream | null) {
    stopTracks(media)
    if (media && stream.value === media) {
      stream.value = null
      camera.value = 'off'
    }
  }

  async function cameraLost(opts: StartOptions) {
    camera.value = 'blocked'
    hint.value = 'camera_off'
    if (!cameraOff) await recordCamera(opts, true)
  }

  /** The chain records the camera going off and back on, so the examiner sees why there is no video. */
  async function recordCamera(opts: StartOptions, off: boolean) {
    cameraOff = off
    if (!off && hint.value === 'camera_off') hint.value = null
    await opts.log.append('proctor.signal', { kind: 'camera_off', active: off }).catch(() => undefined)
  }

  async function shutdown() {
    const current = running
    running = null
    stream.value = null
    camera.value = 'off'
    hint.value = null
    risk.value = 'low'
    if (!current) return
    await current.proctor.stop()
    stopTracks(current.media)
  }

  /** Retry after the student allowed the camera (needs a click, so browsers show the prompt). */
  const retry = () => (options ? start(options) : Promise.resolve())

  function capture(seconds: number) {
    running?.proctor.capture(seconds)
  }

  /** Stops recording and saves the last evidence. Resolves after every earlier start/stop has finished. */
  function stop(): Promise<void> {
    stops++
    launching?.abort()
    return enqueue(shutdown)
  }

  return { stream, camera, problem, problemDetail, hint, risk, recording, start, retry, capture, stop }
})
