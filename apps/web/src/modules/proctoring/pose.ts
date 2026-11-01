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

/** Forehead top, chin, and the two cheeks (MediaPipe face mesh indices): the face's outline. */
const OUTLINE = [10, 152, 234, 454]
/**
 * How far past the picture's edge a point may lie: the model places the forehead's top slightly outside
 * when the student leans in, which is still a face the proctor sees well.
 */
const EDGE_SLACK = 0.06

/**
 * The whole face is in the picture: a face cut off at the chin or the forehead (the camera tilted, the
 * student leaning out) is found by the model but is not someone the proctor can see.
 */
export function isFramed(landmarks: { x: number; y: number }[]): boolean {
  return OUTLINE.every((i) => {
    const p = landmarks[i]
    return !!p && p.x >= -EDGE_SLACK && p.x <= 1 + EDGE_SLACK && p.y >= -EDGE_SLACK && p.y <= 1 + EDGE_SLACK
  })
}

/**
 * How many people are seen: faces wholly in the picture; any second face, even cut off, still counts as
 * someone else being there.
 */
export function countFaces(faces: { x: number; y: number }[][]): number {
  return faces.length >= 2 ? faces.length : faces.filter(isFramed).length
}
