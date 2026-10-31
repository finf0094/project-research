import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { stopTracks } from '@/shared/lib/media'
import { saveBaseline, type Pose } from './calibration'
import { saveTier, tierFromTiming } from './device-tier'
import { createSensors, requestCamera, type Sensors } from './sensors'
import { DARK_BRIGHTNESS } from './signals'

/** `blocked`: no permission or the device went away; `failed`: the analysis could not start here. */
export type ProbeState = 'idle' | 'starting' | 'running' | 'blocked' | 'failed'

/** Frames in a row a check must pass before it counts; a passed check then stays passed. */
const STEADY_FRAMES = 3

/**
 * The camera check before the exam. It runs the heaviest tier and measures it, which decides how much this
 * computer analyses during the exam, and takes the student's pose while they look at the screen as the
 * neutral one for this camera position. The camera is freed when the check ends (the exam asks again;
 * the permission is remembered).
 *
 * Face and light pass once they hold for a moment and then stay passed: a glance at the keyboard must not
 * take the start button away mid-click. `faces`/`brightness` stay live for the picture.
 */
export function useDeviceProbe() {
  const state = ref<ProbeState>('idle')
  const stream = shallowRef<MediaStream | null>(null)
  const faces = ref<number | null>(null)
  const brightness = ref<number | null>(null)
  const hasMic = ref(false)
  const faceSteady = ref(false)
  const lightSteady = ref(false)
  let faceStreak = 0
  let lightStreak = 0
  let sensors: Sensors | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  let disposed = false
  const timings: number[] = []
  const poses: Pose[] = []

  const checks = computed(() => {
    const running = state.value === 'running'
    return [
      { id: 'camera', ok: running, hint: 'camera' },
      { id: 'mic', ok: running && hasMic.value, hint: 'mic' },
      { id: 'face', ok: faceSteady.value, hint: (faces.value ?? 0) > 1 ? 'faceMany' : 'faceNone' },
      { id: 'light', ok: lightSteady.value, hint: 'light' },
    ] as const
  })
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
    hasMic.value = media.getAudioTracks().length > 0
    // An unplugged camera or a revoked permission ends the tracks: the check is no longer passed.
    for (const track of media.getTracks()) track.addEventListener('ended', lost)
    try {
      sensors = await createSensors(media, 'full', { yaw: 0, pitch: 0 })
    } catch (error) {
      console.error('camera analysis did not start', error)
      release()
      state.value = 'failed'
      return
    }
    if (disposed) return release()
    state.value = 'running'
    timer = setInterval(() => void measure(), 500)
  }

  function lost() {
    if (state.value !== 'running') return
    release()
    state.value = 'blocked'
  }

  let measuring = false
  async function measure() {
    if (measuring || !sensors) return // a slow computer: skip a beat instead of piling frames up
    measuring = true
    const frame = await sensors
      .analyze(true)
      .catch(() => null)
      .finally(() => (measuring = false))
    if (!frame || disposed || state.value !== 'running') return
    timings.push(frame.ms)
    if (timings.length >= 6) saveTier(tierFromTiming(median(timings.slice(-6))))
    if (frame.pose) poses.push(frame.pose)
    saveBaseline(poses.slice(-10))
    faces.value = frame.faces
    brightness.value = frame.brightness
    faceStreak = frame.faces === 1 ? faceStreak + 1 : 0
    lightStreak = frame.brightness >= DARK_BRIGHTNESS ? lightStreak + 1 : 0
    if (faceStreak >= STEADY_FRAMES) faceSteady.value = true
    if (lightStreak >= STEADY_FRAMES) lightSteady.value = true
  }

  /** Frees the camera and forgets what was seen: a new start checks everything again. */
  function release() {
    clearInterval(timer)
    sensors?.dispose()
    sensors = null
    for (const track of stream.value?.getTracks() ?? []) track.removeEventListener('ended', lost)
    stopTracks(stream.value)
    stream.value = null
    faces.value = null
    brightness.value = null
    hasMic.value = false
    faceSteady.value = lightSteady.value = false
    faceStreak = lightStreak = 0
  }

  onScopeDispose(() => {
    disposed = true
    release()
  })
  return { state, stream, faces, brightness, checks, ready, start }
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]!
}
