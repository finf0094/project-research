import type { FragmentReason } from '@exam/contracts'
import { sha256Hex } from '@exam/integrity'
import {
  addPin,
  clearRing,
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
 * in IndexedDB, so a reload or a crash loses neither. Pinned chunks are hashed, announced in a sealed
 * `evidence.fragment` event and queued for upload in the same transaction.
 */
export function createEvidence(attemptId: string, log: EventLog) {
  let flushing: Promise<void> = Promise.resolve()

  async function pin({ reason, tStart, tEnd }: PendingPin, ring: RingChunk[]) {
    const picked = ring.filter((c) => c.tStart < tEnd && c.tEnd > tStart)
    if (!picked.length) return
    const hashed = await Promise.all(
      picked.map(async (c) => ({
        chunk: c,
        hash: await sha256Hex(new Uint8Array(await c.blob.arrayBuffer())),
      })),
    )
    await log.append(
      'evidence.fragment',
      { reason, tStart: picked[0]!.tStart, tEnd: picked.at(-1)!.tEnd, chunks: hashed.map((h) => h.hash) },
      () =>
        putChunks(
          hashed.map(({ chunk, hash }) => ({ attemptId, hash, tStart: chunk.tStart, blob: chunk.blob })),
        ),
    )
  }

  /** Pins every request whose time range the ring already covers (or all of them when `final`). */
  function flush(final = false) {
    const run = flushing.then(async () => {
      const ring = await listRing(attemptId)
      const recordedUntil = ring.at(-1)?.tEnd ?? 0
      for (const request of await listPins(attemptId)) {
        if (!final && recordedUntil < request.tEnd) continue
        try {
          await pin(request, ring)
          await deletePin(request.id!)
        } catch (error) {
          // Kept for the next flush (e.g. after the student frees disk space); one failure must not stop the rest.
          console.error('could not save evidence', error)
          if (final) await deletePin(request.id!)
        }
      }
      if (final) await clearRing(attemptId)
    })
    flushing = run.catch(() => undefined)
    return flushing
  }

  return {
    async request(reason: FragmentReason, tStart: number, tEnd: number) {
      await addPin({ attemptId, reason, tStart, tEnd })
      void flush()
    },
    async onChunk(chunk: RecordedChunk) {
      await putRingChunk({ attemptId, ...chunk }, KEEP_MS)
      void flush()
    },
    /** Pins whatever is still requested and drops the ring: the exam is over. */
    finish: () => flush(true),
  }
}
