import type { RecordingMode, RiskLevel, SignalKind } from '@exam/contracts'
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { EventLog } from '@/modules/offline'
import { startProctor, type Proctor } from './proctor'
import { requestCamera } from './sensors'

export type CameraState = 'off' | 'starting' | 'on' | 'blocked'

export interface StartOptions {
  attemptId: string
  log: EventLog
  recording: RecordingMode
  now: () => number
}

/** Camera state and the current hint for the exam screen. */
export const useProctoringStore = defineStore('proctoring', () => {
  const stream = shallowRef<MediaStream | null>(null)
  const camera = ref<CameraState>('off')
  const hint = ref<SignalKind | null>(null)
  const risk = ref<RiskLevel>('low')
  const recording = ref<RecordingMode>('adaptive')
  let proctor: Proctor | null = null
  let options: StartOptions | null = null
  /** Bumped by stop(): a start() still waiting for the camera or the model gives up instead of starting late. */
  let generation = 0
  let starting: Promise<void> | null = null
  let cameraOff = false

  function start(next: StartOptions): Promise<void> {
    if (options && options.attemptId !== next.attemptId) void stop()
    options = next
    recording.value = next.recording
    if (proctor || starting) return starting ?? Promise.resolve()
    starting = run(generation).finally(() => (starting = null))
    return starting
  }

  async function run(gen: number) {
    const opts = options!
    camera.value = 'starting'
    let media: MediaStream
    try {
      media = await requestCamera()
    } catch {
      if (gen === generation) await cameraLost(opts)
      return
    }
    if (gen !== generation) return media.getTracks().forEach((t) => t.stop())

    const started = await startProctor(media, {
      ...opts,
      onHint: (kind) => (hint.value = kind),
      onRisk: (level) => (risk.value = level),
    }).catch((error) => {
      console.error('proctoring could not start', error)
      return null
    })
    if (gen !== generation || !started) {
      await started?.stop()
      media.getTracks().forEach((t) => t.stop())
      if (gen === generation) await cameraLost(opts)
      return
    }
    // A camera that dies mid-exam (unplugged, taken by another app) is recorded and shown at once.
    for (const track of media.getTracks())
      track.addEventListener('ended', () => void stop().then(() => cameraLost(opts)))
    proctor = started
    stream.value = media
    camera.value = 'on'
    if (cameraOff) {
      cameraOff = false
      if (hint.value === 'camera_off') hint.value = null
      await opts.log.append('proctor.signal', { kind: 'camera_off', active: false }).catch(() => undefined)
    }
  }

  /** The chain records the camera being off, so the examiner sees why there is no video. */
  async function cameraLost(opts: StartOptions) {
    camera.value = 'blocked'
    hint.value = 'camera_off'
    if (cameraOff) return
    cameraOff = true
    await opts.log.append('proctor.signal', { kind: 'camera_off', active: true }).catch(() => undefined)
  }

  /** Retry after the student allowed the camera (needs a click, so browsers show the prompt). */
  const retry = () => (options ? start(options) : Promise.resolve())

  function capture(seconds: number) {
    proctor?.capture(seconds)
  }

  /** Stops recording and saves the last evidence; also cancels a start still in progress. */
  async function stop() {
    generation++
    const running = proctor
    proctor = null
    await running?.stop()
    stream.value?.getTracks().forEach((t) => t.stop())
    stream.value = null
    camera.value = 'off'
    hint.value = null
    risk.value = 'low'
  }

  return { stream, camera, hint, risk, recording, start, retry, capture, stop }
})
