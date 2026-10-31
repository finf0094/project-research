import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import type { Pose } from './calibration'

// Head pose and gaze from face landmarks: pure geometry, no model or camera here.

const MAX_YAW_DEG = 30
// Generous on purpose: looking down at allowed scratch paper must not count.
const MAX_PITCH_DEG = 35
/** Iris position between the eye corners (0..1); outside this band the eyes look sideways. */
const GAZE_BAND: [number, number] = [0.3, 0.7]

/** What MediaPipe's face landmarker returns for one frame. */
export type FaceResult = ReturnType<FaceLandmarker['detectForVideo']>

/** Head yaw and pitch in degrees from the face transformation matrix (column-major 4×4). */
export function headPose(face: FaceResult): Pose | null {
  const m = face.facialTransformationMatrixes[0]?.data
  if (!m) return null
  // The rotation's third column is (m[8], m[9], m[10]).
  return {
    yaw: (Math.atan2(m[8]!, m[10]!) * 180) / Math.PI,
    pitch: (Math.atan2(-m[9]!, Math.hypot(m[8]!, m[10]!)) * 180) / Math.PI,
  }
}

/**
 * Head turned away (relative to the calibrated neutral pose, so a camera mounted to the side is not
 * a violation) or both eyes looking sideways (iris between the eye corners).
 */
export function isLookingAway(face: FaceResult, baseline: Pose): boolean {
  const pose = headPose(face)
  if (
    pose &&
    (Math.abs(pose.yaw - baseline.yaw) > MAX_YAW_DEG || Math.abs(pose.pitch - baseline.pitch) > MAX_PITCH_DEG)
  ) {
    return true
  }
  const p = face.faceLandmarks[0]
  if (!p || p.length < 478) return false
  return gazeOff(p[468]!.x, p[33]!.x, p[133]!.x) && gazeOff(p[473]!.x, p[362]!.x, p[263]!.x)
}

function gazeOff(iris: number, cornerA: number, cornerB: number) {
  const ratio = (iris - Math.min(cornerA, cornerB)) / Math.abs(cornerB - cornerA || 1)
  return ratio < GAZE_BAND[0] || ratio > GAZE_BAND[1]
}
