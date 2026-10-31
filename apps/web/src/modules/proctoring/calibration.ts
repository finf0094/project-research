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
