import type { ServerAnalysis } from '@exam/contracts'
import type { BlobStorage } from '../shared/storage.ts'
import { blobKey } from '../shared/storage.ts'
import { loadFaceCounter } from './faces.ts'
import { extractFrames } from './media.ts'
import { MODELS, readModel } from './models.ts'
import { loadObjectDetector } from './objects.ts'
import { toIntervals, type Interval, type Observation } from './observations.ts'

export interface Fragment {
  chunks: string[]
  /** Start time of each chunk (same order as `chunks`). */
  chunkStarts: number[]
}

export interface RecordingsReport {
  status: ServerAnalysis
  findings: Interval[]
}

interface Models {
  faces: (rgb: Buffer) => Promise<number>
  objects: (rgb: Buffer) => Promise<boolean>
}
let cached: Promise<Models | null> | null = null

/** Loaded once per worker process (checksums verified); a failed load is retried next time. */
export function loadModels(): Promise<Models | null> {
  cached ??= (async () => {
    const [faces, objects] = await Promise.all([readModel(MODELS.faces), readModel(MODELS.objects)])
    if (!faces || !objects) return null
    return { faces: await loadFaceCounter(faces), objects: await loadObjectDetector(objects) }
  })().catch((error: unknown) => {
    cached = null
    throw error
  })
  return cached
}

/**
 * Second opinion on the recorded fragments: the server's own models look at every uploaded chunk
 * (one frame per second) and report intervals with another person, no person, or a phone/book.
 * Never throws: a broken analysis must not cost the attempt its other markers.
 */
export async function analyzeRecordings(
  storage: BlobStorage,
  attemptId: string,
  fragments: Fragment[],
  uploaded: ReadonlySet<string>,
): Promise<RecordingsReport> {
  try {
    const models = await loadModels()
    if (!models) return { status: 'unavailable', findings: [] }
    const starts = new Map<string, number>()
    for (const f of fragments) f.chunks.forEach((hash, i) => starts.set(hash, f.chunkStarts[i]!))

    const observations: Observation[] = []
    for (const [hash, chunkStart] of starts) {
      if (!uploaded.has(hash)) continue
      const video = await storage.get(blobKey(attemptId, hash))
      if (!video) continue
      const frames = await extractFrames(video).catch((error: unknown) => {
        console.error(`could not decode chunk ${hash}`, error)
        return []
      })
      for (const [second, frame] of frames.entries()) {
        observations.push({
          at: chunkStart + second * 1000,
          faces: await models.faces(frame),
          object: await models.objects(frame),
        })
      }
    }
    return { status: 'ok', findings: toIntervals(observations) }
  } catch (error) {
    console.error(`server analysis of attempt ${attemptId} failed`, error)
    return { status: 'failed', findings: [] }
  }
}
