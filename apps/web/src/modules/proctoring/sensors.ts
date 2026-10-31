import type { DeviceTier } from '@exam/contracts'
import type { Pose } from './calibration'
import { FaceLandmarker, ObjectDetector } from '@mediapipe/tasks-vision'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'

export interface FrameAnalysis {
  /** Faces in the frame; null when the tier runs no face model. */
  faces: number | null
  /** Head turned or eyes off the screen; null when not measured. */
  lookingAway: boolean | null
  /** Raw head pose, used to calibrate the camera position at preflight. */
  pose: Pose | null
  /** A phone or a book in view; null when not measured this frame. */
  object: boolean | null
}

export interface Sensors {
  analyze(timestamp: number, withObjects: boolean): FrameAnalysis
  /** Mean brightness 0..255 of the current frame. */
  brightness(): number
  /** Microphone level 0..1 (RMS). */
  loudness(): number
  dispose(): void
}

const SAMPLE_W = 32
const SAMPLE_H = 18
const fileset = { wasmLoaderPath, wasmBinaryPath }

/**
 * On-device measurements. Video never leaves the device for analysis: the models and the WASM runtime are
 * served by the app and cached offline. The `minimal` tier loads no model at all (weak computers).
 */
export async function createSensors(stream: MediaStream, tier: DeviceTier, baseline: Pose): Promise<Sensors> {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  await video.play()

  const [landmarker, objects] = await Promise.all([
    tier === 'minimal' ? null : loadLandmarker(),
    tier === 'full' ? loadObjectDetector() : null,
  ])

  const canvas = new OffscreenCanvas(SAMPLE_W, SAMPLE_H)
  const context = canvas.getContext('2d', { willReadFrequently: true })!

  const audio = new AudioContext()
  // Without a user gesture (e.g. after a reload) the context starts suspended and hears nothing.
  const resume = () => void audio.resume()
  if (audio.state === 'suspended') {
    window.addEventListener('pointerdown', resume, { once: true })
    window.addEventListener('keydown', resume, { once: true })
  }
  const analyser = audio.createAnalyser()
  analyser.fftSize = 1024
  audio.createMediaStreamSource(stream).connect(analyser)
  const samples = new Float32Array(analyser.fftSize)

  return {
    analyze(timestamp, withObjects) {
      if (video.readyState < 2) return { faces: null, lookingAway: null, object: null, pose: null }
      const face = landmarker?.detectForVideo(video, timestamp)
      const object =
        withObjects && objects ? objects.detectForVideo(video, timestamp).detections.length > 0 : null
      const single = face?.faceLandmarks.length === 1 ? face : null
      return {
        faces: face ? face.faceLandmarks.length : null,
        lookingAway: single ? isLookingAway(single, baseline) : null,
        object,
        pose: single ? headPose(single) : null,
      }
    },
    brightness() {
      if (video.readyState < 2) return 255
      context.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H)
      const { data } = context.getImageData(0, 0, SAMPLE_W, SAMPLE_H)
      let sum = 0
      for (let i = 0; i < data.length; i += 4)
        sum += 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
      return sum / (data.length / 4)
    },
    loudness() {
      analyser.getFloatTimeDomainData(samples)
      let sum = 0
      for (const s of samples) sum += s * s
      return Math.sqrt(sum / samples.length)
    },
    dispose() {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
      landmarker?.close()
      objects?.close()
      void audio.close()
      video.srcObject = null
    },
  }
}

function loadLandmarker() {
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'CPU' },
    runningMode: 'VIDEO',
    numFaces: 2,
    outputFacialTransformationMatrixes: true,
  }).catch((error) => {
    console.error('face model unavailable', error)
    return null
  })
}

function loadObjectDetector() {
  return ObjectDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: '/models/efficientdet_lite0.tflite', delegate: 'CPU' },
    runningMode: 'VIDEO',
    scoreThreshold: 0.5,
    categoryAllowlist: ['cell phone', 'book'],
  }).catch((error) => {
    console.error('object model unavailable', error)
    return null
  })
}

const MAX_YAW_DEG = 30
// Generous on purpose: looking down at allowed scratch paper must not count.
const MAX_PITCH_DEG = 35
/** Iris position between the eye corners (0..1); outside this band the eyes look sideways. */
const GAZE_BAND: [number, number] = [0.3, 0.7]

type FaceResult = ReturnType<FaceLandmarker['detectForVideo']>

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

export function requestCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15 } },
    audio: { echoCancellation: true, noiseSuppression: true },
  })
}
