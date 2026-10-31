import type { DeviceTier } from '@exam/contracts'
import type { Pose } from './calibration'
import type { FrameReport } from './detectors'
import type { WorkerRequest, WorkerResponse } from './detector.worker'

export type { FrameReport } from './detectors'

export interface Sensors {
  /** Analyses the current frame in the detector worker; null while the camera has no picture yet. */
  analyze(withObjects: boolean): Promise<FrameReport | null>
  /** Tells the worker to drop the models a lower tier does not use. */
  lower(tier: DeviceTier): void
  /** Microphone level 0..1 (RMS). */
  loudness(): number
  dispose(): void
}

/**
 * On-device measurements. Video never leaves the device for analysis: frames go to a Web Worker that runs
 * the models (served by the app and cached offline), so the exam page stays smooth. Sound is measured here,
 * since Web Audio is not available in workers.
 */
export async function createSensors(stream: MediaStream, tier: DeviceTier, baseline: Pose): Promise<Sensors> {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  await video.play()

  const worker = new Worker(new URL('./detector.worker.ts', import.meta.url), { type: 'module' })
  const post = (request: WorkerRequest, transfer: Transferable[] = []) =>
    worker.postMessage(request, transfer)
  const pending = new Map<number, (report: FrameReport | null) => void>()
  let nextId = 0
  /** No more analysis: the page left, or the worker could not run at all. */
  let dead = false
  const settleAll = () => {
    pending.forEach((settle) => settle(null))
    pending.clear()
  }
  let markReady = () => {}
  const ready = new Promise<void>((resolve) => (markReady = resolve))
  worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
    if (data.type === 'ready') return markReady()
    pending.get(data.id)?.(data.report)
    pending.delete(data.id)
  }
  // A worker that cannot load (e.g. a stale chunk after a deploy) analyses nothing; the exam goes on with
  // signals that read "not measured" instead of waiting forever.
  worker.onerror = (event) => {
    console.error('detector worker failed', event.message)
    dead = true
    settleAll()
    markReady()
  }
  post({ type: 'init', tier })
  await ready

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
    async analyze(withObjects) {
      if (dead || video.readyState < 2) return null
      const frame = await createImageBitmap(video).catch(() => null)
      if (!frame || dead) return (frame?.close(), null)
      const id = nextId++
      const report = new Promise<FrameReport | null>((resolve) => pending.set(id, resolve))
      post({ type: 'frame', id, frame, timestamp: performance.now(), withObjects, baseline }, [frame])
      return report
    },
    lower: (next) => post({ type: 'lower', tier: next }),
    loudness() {
      analyser.getFloatTimeDomainData(samples)
      let sum = 0
      for (const s of samples) sum += s * s
      return Math.sqrt(sum / samples.length)
    },
    dispose() {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
      dead = true
      settleAll()
      worker.terminate()
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
