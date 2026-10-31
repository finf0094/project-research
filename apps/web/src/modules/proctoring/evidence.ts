import type { FragmentReason } from '@exam/contracts'
import { sha256Hex } from '@exam/integrity'
import { putChunks, type EventLog } from '@/modules/offline'
import type { RecordedChunk, Recorder } from './recorder'

interface Request {
  reason: FragmentReason
  tStart: number
  tEnd: number
}

/**
 * Turns parts of the ring into evidence: the chunks are hashed, announced in a sealed
 * `evidence.fragment` event and queued for upload in the same IndexedDB transaction.
 * A request covering the future waits until the recorder has produced those chunks.
 */
export function createEvidence(attemptId: string, log: EventLog, recorder: () => Recorder | null) {
  const pending: Request[] = []
  let flushing: Promise<void> = Promise.resolve()

  async function pin({ reason, tStart, tEnd }: Request, chunks: RecordedChunk[]) {
    const picked = chunks.filter((c) => c.tStart < tEnd && c.tEnd > tStart)
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

  /** Pins every request whose time range the recorder has already covered (or all of them when `final`). */
  function flush(final = false) {
    flushing = flushing.then(async () => {
      const chunks = recorder()?.chunks() ?? []
      const recordedUntil = chunks.at(-1)?.tEnd ?? 0
      for (const request of [...pending]) {
        if (!final && recordedUntil < request.tEnd) continue
        pending.splice(pending.indexOf(request), 1)
        await pin(request, chunks)
      }
    })
    return flushing.catch((error) => console.error('could not save evidence', error))
  }

  return {
    request(reason: FragmentReason, tStart: number, tEnd: number) {
      pending.push({ reason, tStart, tEnd })
      void flush()
    },
    onChunk: () => void flush(),
    finish: () => flush(true),
  }
}
