import type { RecordingMode, RiskLevel, SignalKind } from '@exam/contracts'
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { EventLog } from '@/modules/offline'
import { savedBaseline } from './calibration'
import { savedTier } from './device-tier'
import { startProctor, type Proctor } from './proctor'
import { requestCamera } from './sensors'

export type CameraState = 'off' | 'starting' | 'on' | 'blocked'

export interface StartOptions {
  attemptId: string
  log: EventLog
  recording: RecordingMode
  /** Watch the noise level; off for oral exams, where the student talks the whole time. */
  listen: boolean
  now: () => number
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
  const hint = ref<SignalKind | null>(null)
  const risk = ref<RiskLevel>('low')
  const recording = ref<RecordingMode>('adaptive')

  let lifecycle: Promise<void> = Promise.resolve()
  let running: Running | null = null
  let launching: AbortController | null = null
  let options: StartOptions | null = null
  /** Whether the chain currently says the camera is off (per attempt), so changes are recorded once. */
  let cameraOff = false

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
    try {
      const media = await abortable(requestCamera(), abort.signal, (m) => stopTracks(m))
      if (!media) return
      const proctor = await abortable(
        startProctor(media, {
          ...opts,
          tier: savedTier(),
          baseline: savedBaseline(),
          onHint: (kind) => (hint.value = kind),
          onRisk: (level) => (risk.value = level),
        }),
        abort.signal,
        (p) => void p.stop(),
      )
      if (!proctor) return stopTracks(media)

      running = { attemptId: opts.attemptId, proctor, media }
      stream.value = media
      camera.value = 'on'
      if (cameraOff) await recordCamera(opts, false)
      // A camera that dies mid-exam (unplugged, taken by another app) is recorded and shown at once.
      for (const track of media.getTracks()) {
        track.addEventListener('ended', () =>
          enqueue(async () => {
            if (running?.proctor !== proctor) return
            await shutdown()
            await cameraLost(opts)
          }),
        )
      }
    } catch (error) {
      console.error('proctoring could not start', error)
      if (!abort.signal.aborted) await cameraLost(opts)
    } finally {
      if (launching === abort) launching = null
      if (camera.value === 'starting') camera.value = 'off'
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
    launching?.abort()
    return enqueue(shutdown)
  }

  return { stream, camera, hint, risk, recording, start, retry, capture, stop }
})

function stopTracks(media: MediaStream) {
  media.getTracks().forEach((t) => t.stop())
}

/** Resolves with the value, or with null if aborted first; a value arriving after the abort is cleaned up. */
function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  cleanup: (value: T) => void,
): Promise<T | null> {
  if (signal.aborted) {
    void promise.then(cleanup, () => undefined)
    return Promise.resolve(null)
  }
  return new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => resolve(null), { once: true })
    promise.then(
      (value) => (signal.aborted ? cleanup(value) : resolve(value)),
      (error) => (signal.aborted ? undefined : reject(error)),
    )
  })
}
