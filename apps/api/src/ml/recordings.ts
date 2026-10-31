import { existsSync } from 'node:fs'
import type { BlobStorage } from '../shared/storage.ts'
import { blobKey } from '../shared/storage.ts'
import { loadFaceCounter } from './faces.ts'
import { extractFrames } from './media.ts'
import { MODELS, modelPath } from './models.ts'
import { loadObjectDetector } from './objects.ts'
import { toIntervals, type Interval, type Observation } from './observations.ts'

export interface Fragment {
  tStart: number
  chunks: string[]
}

/** Recorded chunks are 10 s each and follow each other inside a fragment. */
const CHUNK_MS = 10_000

type Models = { faces: (rgb: Buffer) => Promise<number>; objects: (rgb: Buffer) => Promise<boolean> }
let models: Promise<Models | null> | null = null

/** Loaded once per worker process; null when the model files are missing (`pnpm models` not run). */
function loadModels(): Promise<Models | null> {
  models ??= (async () => {
    if (!existsSync(modelPath(MODELS.faces)) || !existsSync(modelPath(MODELS.objects))) {
      console.warn('ML models missing: server-side analysis of recordings is skipped (run `pnpm models`)')
      return null
    }
    return {
      faces: await loadFaceCounter(modelPath(MODELS.faces)),
      objects: await loadObjectDetector(modelPath(MODELS.objects)),
    }
  })()
  return models
}

/**
 * Second opinion on the recorded fragments: the server's own models look at every uploaded chunk
 * (one frame per second) and report intervals with another person, no person, or a phone/book.
 * Returns null when server analysis is not available, so callers can tell "nothing found" from "not checked".
 */
export async function analyzeRecordings(
  storage: BlobStorage,
  attemptId: string,
  fragments: Fragment[],
  uploaded: ReadonlySet<string>,
): Promise<Interval[] | null> {
  const loaded = await loadModels()
  if (!loaded) return null
  const seen = new Set<string>()
  const observations: Observation[] = []
  for (const fragment of fragments) {
    for (const [index, hash] of fragment.chunks.entries()) {
      if (seen.has(hash) || !uploaded.has(hash)) continue
      seen.add(hash)
      const video = await storage.get(blobKey(attemptId, hash))
      if (!video) continue
      const frames = await extractFrames(video).catch((error) => {
        console.error(`could not decode chunk ${hash}`, error)
        return []
      })
      const chunkStart = fragment.tStart + index * CHUNK_MS
      for (const [second, frame] of frames.entries()) {
        observations.push({
          at: chunkStart + second * 1000,
          faces: await loaded.faces(frame),
          object: await loaded.objects(frame),
        })
      }
    }
  }
  return toIntervals(observations)
}
