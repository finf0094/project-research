import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { stopTracks } from '@/shared/lib/media'
import { saveBaseline, type Pose } from './calibration'
import { saveTier, tierFromTiming } from './device-tier'
import { createSensors, requestCamera, type Sensors } from './sensors'
import { DARK_BRIGHTNESS } from './signals'

export type ProbeState = 'idle' | 'starting' | 'running' | 'blocked'

/**
 * The camera check before the exam. It runs the heaviest tier and measures it, which decides how much this
 * computer analyses during the exam, and takes the student's pose while they look at the screen as the
 * neutral one for this camera position. The camera is freed when the check ends (the exam asks again;
 * the permission is remembered).
 */
export function useDeviceProbe() {
  const state = ref<ProbeState>('idle')
  const stream = shallowRef<MediaStream | null>(null)
  const faces = ref<number | null>(null)
  const brightness = ref(255)
  let sensors: Sensors | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  let disposed = false
  const timings: number[] = []
  const poses: Pose[] = []

  const checks = computed(
    () =>
      [
        { id: 'camera', ok: state.value === 'running', hint: 'camera' },
        { id: 'face', ok: faces.value === 1, hint: faces.value && faces.value > 1 ? 'faceMany' : 'faceNone' },
        { id: 'light', ok: brightness.value >= DARK_BRIGHTNESS, hint: 'light' },
      ] as const,
  )
  const ready = computed(() => checks.value.every((c) => c.ok))

  async function start() {
    release()
    state.value = 'starting'
    let media: MediaStream
    try {
      media = await requestCamera()
    } catch {
      state.value = 'blocked'
      return
    }
    if (disposed) return stopTracks(media)
    stream.value = media
    sensors = await createSensors(media, 'full', { yaw: 0, pitch: 0 })
    if (disposed) return release()
    state.value = 'running'
    timer = setInterval(() => void measure(), 500)
  }

  let measuring = false
  async function measure() {
    if (measuring || !sensors) return // a slow computer: skip a beat instead of piling frames up
    measuring = true
    const frame = await sensors.analyze(true).finally(() => (measuring = false))
    if (!frame || disposed) return
    timings.push(frame.ms)
    if (timings.length >= 6) saveTier(tierFromTiming(median(timings.slice(-6))))
    if (frame.pose) poses.push(frame.pose)
    saveBaseline(poses.slice(-10))
    faces.value = frame.faces
    brightness.value = frame.brightness
  }

  function release() {
    clearInterval(timer)
    sensors?.dispose()
    sensors = null
    stopTracks(stream.value)
    stream.value = null
  }

  onScopeDispose(() => {
    disposed = true
    release()
  })
  return { state, stream, checks, ready, start }
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]!
}
