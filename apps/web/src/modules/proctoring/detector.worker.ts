/// <reference lib="webworker" />
import type { DeviceTier } from '@exam/contracts'
import type { Pose } from './calibration'
import { loadDetectors, type Detectors, type FrameReport } from './detectors'

/**
 * The detector worker: the models run here, so analysis never makes the exam page stutter (architecture,
 * section 15). Frames arrive as transferred ImageBitmaps and are closed after use. Every frame gets a
 * reply, a failed one with `report: null`, so the page never waits forever.
 */
export type WorkerRequest =
  | { type: 'init'; tier: DeviceTier }
  | { type: 'frame'; id: number; frame: ImageBitmap; timestamp: number; withObjects: boolean; baseline: Pose }
  | { type: 'lower'; tier: DeviceTier }

/** `ok: false`: the models could not load, so no frame will ever be analysed. */
export type WorkerResponse =
  | { type: 'ready'; ok: boolean }
  | { type: 'report'; id: number; report: FrameReport | null }

declare const self: DedicatedWorkerGlobalScope
const reply = (response: WorkerResponse) => self.postMessage(response)

let detectors: Promise<Detectors | null> | null = null

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  if (data.type === 'init') {
    detectors = loadDetectors(data.tier).catch((error: unknown) => {
      console.error('detectors unavailable', error)
      return null
    })
    return reply({ type: 'ready', ok: (await detectors) !== null })
  }
  const loaded = await detectors
  if (data.type === 'lower') return loaded?.lower(data.tier)
  let report: FrameReport | null = null
  try {
    report = loaded?.analyze(data.frame, data.timestamp, data.withObjects, data.baseline) ?? null
  } catch (error) {
    console.error('frame analysis failed', error)
  } finally {
    data.frame.close()
  }
  reply({ type: 'report', id: data.id, report })
}
