import Dexie from 'dexie'
import { ApiError, isNetworkError, upload } from '@/shared/lib/http'
import { db } from './db'

/** A few chunks per sync tick, so uploads never hold back answers for long. */
export const CHUNKS_PER_TICK = 3
/** Once the attempt is closed only the recording is left: larger batches, fewer sync requests in between. */
export const CHUNKS_PER_TICK_CLOSED = 10

/**
 * Uploads queued recording chunks in recording order. A network failure stops and leaves the rest for the
 * next tick; a chunk the server refuses for good (window closed, never announced) is dropped so it cannot
 * block the others. True when a full batch went through and more chunks may be waiting.
 */
export async function uploadChunks(
  attemptId: string,
  signal: AbortSignal,
  running: () => boolean,
  limit = CHUNKS_PER_TICK,
): Promise<boolean> {
  const chunks = await db.chunks
    .where('[attemptId+tStart]')
    .between([attemptId, Dexie.minKey], [attemptId, Dexie.maxKey])
    .limit(limit)
    .toArray()
  for (const chunk of chunks) {
    try {
      await upload(`/attempts/${attemptId}/chunks/${chunk.hash}`, chunk.blob, signal)
    } catch (error) {
      // No network, or no session (it expired; the student signs in again): the chunk waits, not lost.
      if (isNetworkError(error) || isSignedOut(error) || !running()) return false
      console.error('chunk refused, dropping it', chunk.hash, error)
    }
    await db.chunks.delete([attemptId, chunk.hash])
  }
  return chunks.length === limit
}

const isSignedOut = (error: unknown) => error instanceof ApiError && [401, 403].includes(error.status)
