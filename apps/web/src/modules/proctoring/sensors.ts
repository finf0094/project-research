import type { DeviceTier } from '@exam/contracts'
import type { Pose } from './calibration'
import type { FrameReport } from './detectors'
import type { WorkerRequest, WorkerResponse } from './detector.worker'
import { listenToMicrophone } from './loudness'

/** Models are large; on a slow link they may take a while, but a fetch that stalls must not wait forever. */
const READY_TIMEOUT_MS = 60_000

export type { FrameReport } from './detectors'

export interface Sensors {
  /** Analyses the current frame in the detector worker; null while the camera has no picture yet. */
  analyze(withObjects: boolean): Promise<FrameReport | null>
  /** Tells the worker to drop the models a lower tier does not use. */
  lower(tier: DeviceTier): void
  /** Microphone level 0..1 (RMS), steady over the last second (see loudness.ts). */
  loudness(): number
  /** True once the detector worker has died: no frame will be analysed again. */
  dead(): boolean
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
  // iOS may refuse to start playback (Low Power Mode, no gesture yet): analysis waits, the camera stays on.
  const play = () => video.play().catch((error: unknown) => console.warn('camera preview paused', error))
  await play()

  const worker = startWorker()
  const post = (request: WorkerRequest, transfer: Transferable[] = []) =>
    worker?.postMessage(request, transfer)
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
  // A worker that cannot load (e.g. a stale chunk after a deploy) or loads too slowly (a phone on a weak
  // network) analyses nothing; the exam goes on, still recorded, with signals that read "not measured".
  const giveUp = () => {
    dead = true
    settleAll()
    markReady()
  }
  if (worker) {
    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.type === 'ready') return markReady()
      pending.get(data.id)?.(data.report)
      pending.delete(data.id)
    }
    worker.onerror = (event) => {
      console.error('detector worker failed', event.message)
      giveUp()
    }
  } else giveUp()
  const timeout = setTimeout(() => {
    console.error('detectors did not load in time; analysing nothing on this device')
    worker?.terminate()
    giveUp()
  }, READY_TIMEOUT_MS)
  post({ type: 'init', tier })
  await ready
  clearTimeout(timeout)

  const microphone = listenToMicrophone(stream)

  return {
    async analyze(withObjects) {
      // iOS pauses the video while the page is in the background and does not always resume it.
      if (video.paused) void play()
      if (dead || video.readyState < 2) return null
      const frame = await createImageBitmap(video).catch(() => null)
      if (!frame || dead) return (frame?.close(), null)
      const id = nextId++
      const report = new Promise<FrameReport | null>((resolve) => pending.set(id, resolve))
      post({ type: 'frame', id, frame, timestamp: performance.now(), withObjects, baseline }, [frame])
      return report
    },
    lower: (next) => post({ type: 'lower', tier: next }),
    loudness: microphone.level,
    dead: () => dead,
    dispose() {
      microphone.stop()
      dead = true
      settleAll()
      worker?.terminate()
      video.srcObject = null
    },
  }
}

/** The detector worker, or null where the browser refuses to start one (no module workers, a policy). */
function startWorker(): Worker | null {
  try {
    return new Worker(new URL('./detector.worker.ts', import.meta.url), { type: 'module' })
  } catch (error) {
    console.error('detector worker cannot start in this browser', error)
    return null
  }
}

export function requestCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15 } },
    // No automatic gain: it would raise a quiet room's level over time, and the noise threshold is
    // measured against the room's quiet level at preflight.
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
  })
}
