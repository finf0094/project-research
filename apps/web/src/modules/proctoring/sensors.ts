import type { DeviceTier } from '@exam/contracts'
import { FaceLandmarker, ObjectDetector } from '@mediapipe/tasks-vision'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'

export interface FrameAnalysis {
  /** Faces in the frame; null when the tier runs no face model. */
  faces: number | null
  /** Head turned or eyes off the screen; null when not measured. */
  lookingAway: boolean | null
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
export async function createSensors(stream: MediaStream, tier: DeviceTier): Promise<Sensors> {
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
      if (video.readyState < 2) return { faces: null, lookingAway: null, object: null }
      const face = landmarker?.detectForVideo(video, timestamp)
      const object =
        withObjects && objects ? objects.detectForVideo(video, timestamp).detections.length > 0 : null
      return {
        faces: face ? face.faceLandmarks.length : null,
        lookingAway: face?.faceLandmarks.length === 1 ? isLookingAway(face) : null,
        object,
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
const MAX_PITCH_DEG = 25
/** Iris position between the eye corners (0..1); outside this band the eyes look sideways. */
const GAZE_BAND: [number, number] = [0.3, 0.7]

/** Head pose from the face transformation matrix, gaze from iris landmarks relative to the eye corners. */
export function isLookingAway(face: ReturnType<FaceLandmarker['detectForVideo']>): boolean {
  const m = face.facialTransformationMatrixes[0]?.data
  if (m) {
    // Column-major 4×4: the rotation's third column is (m[8], m[9], m[10]).
    const yaw = (Math.atan2(m[8]!, m[10]!) * 180) / Math.PI
    const pitch = (Math.atan2(-m[9]!, Math.hypot(m[8]!, m[10]!)) * 180) / Math.PI
    if (Math.abs(yaw) > MAX_YAW_DEG || Math.abs(pitch) > MAX_PITCH_DEG) return true
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
