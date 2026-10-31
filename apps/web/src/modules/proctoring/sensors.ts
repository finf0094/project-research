import { FaceDetector } from '@mediapipe/tasks-vision'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'

export interface Sensors {
  /** Faces in the current frame, or null if the detector could not run. */
  faces(now: number): number | null
  /** Mean brightness 0..255 of the current frame. */
  brightness(): number
  /** Microphone level 0..1 (RMS). */
  loudness(): number
  dispose(): void
}

const SAMPLE_W = 32
const SAMPLE_H = 18

/**
 * Lightweight on-device measurements. Video never leaves the device for analysis:
 * the face model (≈230 KB) and its WASM runtime are served by the app and cached offline.
 * The detector runs on the main thread at 1–4 frames per second, which costs a few ms per second.
 */
export async function createSensors(stream: MediaStream): Promise<Sensors> {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  await video.play()

  const detector = await FaceDetector.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    {
      baseOptions: { modelAssetPath: '/models/blaze_face_short_range.tflite', delegate: 'CPU' },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.6,
    },
  ).catch((error) => {
    console.error('face detector unavailable', error)
    return null
  })

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
    faces(now) {
      if (!detector || video.readyState < 2) return null
      return detector.detectForVideo(video, now).detections.length
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
      detector?.close()
      void audio.close()
      video.srcObject = null
    },
  }
}

export function requestCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15 } },
    audio: { echoCancellation: true, noiseSuppression: true },
  })
}
