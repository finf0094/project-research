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
  let proctor: Proctor | null = null
  let lastOptions: StartOptions | null = null

  async function start(options: StartOptions) {
    if (proctor || camera.value === 'starting') return
    lastOptions = options
    camera.value = 'starting'
    try {
      stream.value = await requestCamera()
    } catch {
      camera.value = 'blocked'
      return
    }
    // A camera that dies mid-exam (unplugged, taken by another app) is shown to the student at once.
    stream.value
      .getVideoTracks()[0]
      ?.addEventListener('ended', () => void stop().then(() => (camera.value = 'blocked')))
    proctor = await startProctor(stream.value, {
      ...options,
      onHint: (kind) => (hint.value = kind),
      onRisk: (level) => (risk.value = level),
    })
    camera.value = 'on'
  }

  /** Retry after the student allowed the camera (needs a click, so browsers show the prompt). */
  const retry = () => (lastOptions ? start(lastOptions) : Promise.resolve())

  function capture(seconds: number) {
    proctor?.capture(seconds)
  }

  async function stop() {
    const running = proctor
    proctor = null
    await running?.stop()
    stream.value?.getTracks().forEach((t) => t.stop())
    stream.value = null
    camera.value = 'off'
    hint.value = null
  }

  return { stream, camera, hint, risk, start, retry, capture, stop }
})
