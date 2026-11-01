import type { DeviceTier } from '@exam/contracts'
import { FaceLandmarker, ObjectDetector } from '@mediapipe/tasks-vision'
// The ES-module build of MediaPipe's WASM glue: module workers load it with a plain import (no eval).
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_module_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_module_internal.wasm?url'
import type { Pose } from './calibration'
import { countFaces, headPose, isInOval, isLookingAway } from './pose'

/** What one analysed frame says. Fields are null when the tier does not measure them. */
export interface FrameReport {
  faces: number | null
  lookingAway: boolean | null
  /** The single face is inside the preflight oval (null when there is not exactly one face). */
  inOval: boolean | null
  /** Raw head pose, used to calibrate the camera position at preflight. */
  pose: Pose | null
  object: boolean | null
  /** Mean brightness 0..255. */
  brightness: number
  /** How long the analysis took, for adapting the tier. */
  ms: number
}

const SAMPLE_W = 32
const SAMPLE_H = 18
const fileset = { wasmLoaderPath, wasmBinaryPath }

/**
 * The on-device models (runs inside the detector worker). Every tier checks the face (the weakest one less
 * often, architecture 10.5); `full` also finds phones and books. A model that fails to
 * load is left out, so its signals read "not measured" instead of breaking the exam.
 */
export async function loadDetectors(tier: DeviceTier) {
  const [landmarker, loadedObjects] = await Promise.all([
    load('face', () => FaceLandmarker.createFromOptions(fileset, FACE_OPTIONS)),
    tier === 'full' ? load('object', () => ObjectDetector.createFromOptions(fileset, OBJECT_OPTIONS)) : null,
  ])
  let objects = loadedObjects
  const canvas = new OffscreenCanvas(SAMPLE_W, SAMPLE_H)
  const context = canvas.getContext('2d', { willReadFrequently: true })!

  function brightness(frame: ImageBitmap) {
    context.drawImage(frame, 0, 0, SAMPLE_W, SAMPLE_H)
    const { data } = context.getImageData(0, 0, SAMPLE_W, SAMPLE_H)
    let sum = 0
    for (let i = 0; i < data.length; i += 4)
      sum += 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
    return sum / (data.length / 4)
  }

  return {
    analyze(frame: ImageBitmap, timestamp: number, withObjects: boolean, baseline: Pose): FrameReport {
      const started = performance.now()
      const face = landmarker?.detectForVideo(frame, timestamp)
      const seen = face ? countFaces(face.faceLandmarks) : null
      const single = seen === 1 ? face : null
      const object =
        withObjects && objects ? objects.detectForVideo(frame, timestamp).detections.length > 0 : null
      return {
        faces: seen,
        lookingAway: single ? isLookingAway(single, baseline) : null,
        inOval: single ? isInOval(single.faceLandmarks[0]!) : null,
        pose: single ? headPose(single) : null,
        object,
        brightness: brightness(frame),
        ms: performance.now() - started,
      }
    },
    /** Lowers the tier: models the new tier does not use are closed. */
    lower(next: DeviceTier) {
      if (next !== 'full') objects = (objects?.close(), null)
    },
    close() {
      landmarker?.close()
      objects?.close()
    },
  }
}

export type Detectors = Awaited<ReturnType<typeof loadDetectors>>

const FACE_OPTIONS = {
  baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'CPU' as const },
  runningMode: 'VIDEO' as const,
  numFaces: 2,
  outputFacialTransformationMatrixes: true,
}

const OBJECT_OPTIONS = {
  baseOptions: { modelAssetPath: '/models/efficientdet_lite0.tflite', delegate: 'CPU' as const },
  runningMode: 'VIDEO' as const,
  scoreThreshold: 0.5,
  categoryAllowlist: ['cell phone', 'book'],
}

function load<T>(name: string, create: () => Promise<T>): Promise<T | null> {
  return create().catch((error: unknown) => {
    console.error(`${name} model unavailable`, error)
    return null
  })
}
