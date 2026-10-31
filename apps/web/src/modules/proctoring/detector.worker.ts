/// <reference lib="webworker" />
import type { DeviceTier } from '@exam/contracts'
import type { Pose } from './calibration'
import { loadDetectors, type Detectors } from './detectors'

/**
 * The detector worker: the models run here, so analysis never makes the exam page stutter (architecture,
 * section 15). Frames arrive as transferred ImageBitmaps and are closed after use.
 */
export type WorkerRequest =
  | { type: 'init'; tier: DeviceTier }
  | { type: 'frame'; id: number; frame: ImageBitmap; timestamp: number; withObjects: boolean; baseline: Pose }
  | { type: 'lower'; tier: DeviceTier }

declare const self: DedicatedWorkerGlobalScope & { import?: (url: string) => Promise<void> }

// MediaPipe loads its WASM glue with importScripts, which module workers lack; it then calls self.import.
// The glue is a classic script that must define a global, so it is evaluated in the global scope.
self.import = async (url) => {
  const code = await (await fetch(url)).text()
  ;(0, eval)(code)
}

let detectors: Promise<Detectors | null> | null = null

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  if (data.type === 'init') {
    detectors = loadDetectors(data.tier).catch((error: unknown) => {
      console.error('detectors unavailable', error)
      return null
    })
    await detectors
    return self.postMessage({ type: 'ready' })
  }
  const loaded = await detectors
  if (data.type === 'lower') return loaded?.lower(data.tier)
  try {
    const report = loaded?.analyze(data.frame, data.timestamp, data.withObjects, data.baseline) ?? null
    self.postMessage({ type: 'report', id: data.id, report })
  } finally {
    data.frame.close()
  }
}
