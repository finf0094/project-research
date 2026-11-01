import { median, quantile } from './stats'

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
    const stored = localStorage.getItem(NOISE_KEY)
    const value = Number(stored)
    return stored !== null && Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

/**
 * The quietest quarter of the preflight's levels: the student may talk now and then during the check,
 * the room's own hum is there throughout. While the browser keeps the sound off (all zeros) nothing is
 * known, and a level kept from an earlier check (maybe in another room) is dropped: the default applies.
 */
export function saveNoiseFloor(levels: number[]) {
  const heard = levels.filter((l) => l > 0)
  try {
    if (heard.length < 4) localStorage.removeItem(NOISE_KEY)
    else localStorage.setItem(NOISE_KEY, String(quantile(heard, 0.25)))
  } catch {
    /* the default threshold is used */
  }
}
