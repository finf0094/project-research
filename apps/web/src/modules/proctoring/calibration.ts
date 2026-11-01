export interface Pose {
  yaw: number
  pitch: number
}

const KEY = 'exam.poseBaseline'
const NEUTRAL: Pose = { yaw: 0, pitch: 0 }

/**
 * The head pose of the student looking at the screen, measured at preflight. A webcam above or beside
 * the screen shifts every pose by a constant; comparing against this baseline removes that offset.
 */
export function savedBaseline(): Pose {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Pose | null
    return value && Number.isFinite(value.yaw) && Number.isFinite(value.pitch) ? value : NEUTRAL
  } catch {
    return NEUTRAL
  }
}

export function saveBaseline(poses: Pose[]) {
  if (!poses.length) return
  const median = (values: number[]) => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ yaw: median(poses.map((p) => p.yaw)), pitch: median(poses.map((p) => p.pitch)) }),
    )
  } catch {
    /* the neutral pose is used */
  }
}

const NOISE_KEY = 'exam.noiseFloor'

/** The room's quiet level (microphone RMS) measured at preflight; null when it was not measured here. */
export function savedNoiseFloor(): number | null {
  try {
    const value = Number(localStorage.getItem(NOISE_KEY))
    return localStorage.getItem(NOISE_KEY) !== null && Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

/**
 * The quietest quarter of the preflight's levels: the student may talk now and then during the check,
 * the room's own hum is there throughout. Nothing is saved while the browser kept the sound off (all zeros).
 */
export function saveNoiseFloor(levels: number[]) {
  const heard = levels.filter((l) => l > 0)
  if (heard.length < 4) return
  try {
    localStorage.setItem(NOISE_KEY, String(heard.toSorted((a, b) => a - b)[Math.floor(heard.length / 4)]))
  } catch {
    /* the default threshold is used */
  }
}
