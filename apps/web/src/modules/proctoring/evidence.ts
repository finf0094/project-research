import type { FragmentReason } from '@exam/contracts'
import { sha256Hex } from '@exam/integrity'
import {
  addPin,
  clearRecording,
  deletePin,
  listPins,
  listRing,
  putChunks,
  putRingChunk,
  type EventLog,
  type PendingPin,
  type RingChunk,
} from '@/modules/offline'
import type { RecordedChunk } from './recorder'

const KEEP_MS = 3 * 60_000

/**
 * Keeps the recording ring and turns parts of it into evidence. Both the ring and the pending requests live
 * in IndexedDB, so a reload or a crash loses neither. All operations run through one queue, so `finish`
 * sees every chunk and request that came before it. Pinned chunks are hashed, announced in a sealed
 * `evidence.fragment` event, queued for upload and their request removed — all in one transaction.
 */
export function createEvidence(attemptId: string, log: EventLog) {
  let queue: Promise<void> = Promise.resolve()
  const enqueue = (operation: () => Promise<void>) => {
    const run = queue.then(operation)
    queue = run.catch((error) => console.error('could not save evidence', error))
    return queue
  }

  async function pin(request: PendingPin, ring: RingChunk[]) {
    const picked = ring.filter((c) => c.tStart < request.tEnd && c.tEnd > request.tStart)
    if (!picked.length) {
      console.warn('nothing recorded for a requested fragment', request)
      return deletePin(request.id!)
    }
    const hashed = await Promise.all(
      picked.map(async (c) => ({
        chunk: c,
        hash: await sha256Hex(new Uint8Array(await c.blob.arrayBuffer())),
      })),
    )
    await log.append(
      'evidence.fragment',
      {
        reason: request.reason,
        tStart: picked[0]!.tStart,
        tEnd: picked.at(-1)!.tEnd,
        chunks: hashed.map((h) => h.hash),
        chunkStarts: picked.map((c) => c.tStart),
      },
      async () => {
        await putChunks(
          hashed.map(({ chunk, hash }) => ({ attemptId, hash, tStart: chunk.tStart, blob: chunk.blob })),
        )
        await deletePin(request.id!)
      },
    )
  }

  /** Pins every request whose time range the ring already covers (or all of them when `final`). */
  async function flush(final: boolean) {
    const ring = await listRing(attemptId)
    const recordedUntil = ring.at(-1)?.tEnd ?? 0
    for (const request of await listPins(attemptId)) {
      if (!final && recordedUntil < request.tEnd) continue
      try {
        await pin(request, ring)
      } catch (error) {
        // Kept for the next flush (e.g. after the student frees disk space); one failure must not stop the rest.
        console.error('could not pin a fragment', error)
        if (final) await deletePin(request.id!)
      }
    }
  }

  return {
    request: (reason: FragmentReason, tStart: number, tEnd: number) =>
      enqueue(async () => {
        await addPin({ attemptId, reason, tStart, tEnd })
        await flush(false)
      }),
    onChunk: (chunk: RecordedChunk) =>
      enqueue(async () => {
        await putRingChunk({ attemptId, ...chunk }, KEEP_MS)
        await flush(false)
      }),
    /** Pins whatever is still requested and drops the ring: the exam is over. */
    finish: () =>
      enqueue(async () => {
        await flush(true)
        await clearRecording(attemptId)
      }),
  }
}
