import type { EventData, ServerAnalysis } from '@exam/contracts'
import type { BlobStorage } from '../shared/storage.ts'
import { blobKey } from '../shared/storage.ts'
import { loadFaceCounter } from './faces.ts'
import { decodeAudio } from '../media/audio.ts'
import { extractFrames, isDark, loudSeconds } from './media.ts'
import { MODELS, readModel } from './models.ts'
import { loadObjectDetector } from './objects.ts'
import { toIntervals, type Interval, type Observation } from './observations.ts'

/** A recorded fragment as the device sealed it in its `evidence.fragment` event. */
export type Fragment = EventData<'evidence.fragment'>

export interface RecordingsReport {
  status: ServerAnalysis
  findings: Interval[]
  /** Chunks the models actually looked at. */
  checked: ReadonlySet<string>
}

export interface Models {
  faces: (rgb: Buffer) => Promise<number>
  objects: (rgb: Buffer) => Promise<boolean>
}
let cached: Promise<Models | null> | null = null

/** Loaded once per worker process (checksums verified); missing files or a failed load are retried next time. */
export async function loadModels(): Promise<Models | null> {
  cached ??= (async () => {
    const [faces, objects] = await Promise.all([readModel(MODELS.faces), readModel(MODELS.objects)])
    if (!faces || !objects) return null
    return { faces: await loadFaceCounter(faces), objects: await loadObjectDetector(objects) }
  })()
  const loading = cached
  const forget = () => cached === loading && (cached = null)
  try {
    return (await loading) ?? (forget(), null)
  } catch (error) {
    forget()
    throw error
  }
}

/**
 * Second opinion on the recorded fragments: the server's own models look at every uploaded chunk
 * (one frame per second) and report intervals with another person, no person, a phone/book, or noise.
 * Never throws: a broken analysis must not cost the attempt its other markers.
 */
export async function analyzeRecordings(
  storage: BlobStorage,
  attemptId: string,
  fragments: Fragment[],
  uploaded: ReadonlySet<string>,
  /** Called after every chunk, so a long analysis can keep its claim on the attempt. */
  heartbeat: () => Promise<void> = async () => undefined,
  /** Chunks the live analysis already looked at during the exam: not decoded twice. */
  known: ReadonlyMap<string, Observation[]> = new Map(),
): Promise<RecordingsReport> {
  const checked = new Set<string>()
  try {
    const models = await loadModels()
    if (!models) return { status: 'unavailable', findings: [], checked }
    const starts = new Map<string, number>()
    for (const f of fragments) f.chunks.forEach((hash, i) => starts.set(hash, f.chunkStarts[i]!))

    const observations: Observation[] = []
    for (const [hash, chunkStart] of starts) {
      if (!uploaded.has(hash)) continue
      // An empty entry is a chunk that could not be decoded live: tried again here.
      const seen = known.get(hash)?.length
        ? known.get(hash)!
        : await observeChunk(models, storage, attemptId, hash, chunkStart)
      if (seen) {
        observations.push(...seen)
        checked.add(hash)
      }
      await heartbeat()
    }
    return { status: 'ok', findings: toIntervals(observations), checked }
  } catch (error) {
    console.error(`server analysis of attempt ${attemptId} failed`, error)
    return { status: 'failed', findings: [], checked }
  }
}

/**
 * What the models see in one recorded chunk, one frame per second; null when the chunk is missing or
 * cannot be decoded. Used by the analysis after the exam and by the live one during it.
 */
export async function observeChunk(
  models: Models,
  storage: BlobStorage,
  attemptId: string,
  hash: string,
  chunkStart: number,
): Promise<Observation[] | null> {
  const video = await storage.get(blobKey(attemptId, hash))
  const frames = video
    ? await extractFrames(video).catch((error: unknown) => {
        console.error(`could not decode chunk ${hash}`, error)
        return null
      })
    : null
  if (!frames) return null
  // A chunk whose sound cannot be read still counts for its pictures: it is just quiet.
  const sound = await decodeAudio(video!).catch((error: unknown) => {
    console.error(`could not decode the sound of chunk ${hash}`, error)
    return null
  })
  const loud = sound ? loudSeconds(sound) : []
  const observations: Observation[] = []
  for (const [second, frame] of frames.entries()) {
    observations.push({
      at: chunkStart + second * 1000,
      faces: await models.faces(frame),
      object: await models.objects(frame),
      dark: isDark(frame),
      loud: loud[second] ?? false,
    })
  }
  return observations
}
