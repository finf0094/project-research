import { createHash } from 'node:crypto'
import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { attempts, blobs, events, exams } from '../db/schema.ts'
import type { Deps } from '../deps.ts'
import {
  AUDIO_LEASE_MS,
  BYTES_PER_SECOND,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_TRIES,
  decodeAudio,
  encodeOpus,
  silence,
} from '../media/audio.ts'
import { blobKey } from '../shared/storage.ts'

/** A claim older than this belongs to a worker that died. */
const CLAIM_LEASE_MS = AUDIO_LEASE_MS

/** Gaps longer than this between chunks (a reload, the camera restarting) are kept as silence. */
const GAP_MS = 500

/**
 * merge-audio: once an oral attempt is analysed (its uploads are in or their window is over), joins the
 * sound of all its recorded chunks into one file the examiner can listen to in one go, including what was
 * said while the call was down. Gaps between chunks stay as silence, so a position in the file matches the
 * clock. Unreadable chunks are skipped; a failed run is retried a few times. False when there is nothing to do.
 */
export async function mergeNextAudio(deps: Deps): Promise<boolean> {
  const attempt = await claimNext(deps)
  if (!attempt) return false
  try {
    const audioHash = await merge(deps, attempt.id)
    await deps.db
      .update(attempts)
      .set({ audioHash, audioMergedAt: new Date(deps.now()), audioClaimedAt: null })
      .where(eq(attempts.id, attempt.id))
  } catch (error) {
    console.error(`audio of attempt ${attempt.id} could not be merged`, error)
    // The claim stays as the pause before the next try (a fixed lease); after the last try it is released,
    // so the examiner sees "failed" at once instead of "pending".
    if (attempt.audioTries + 1 >= MAX_AUDIO_TRIES)
      await deps.db.update(attempts).set({ audioClaimedAt: null }).where(eq(attempts.id, attempt.id))
  }
  return true
}

async function claimNext({ db, now }: Deps) {
  const leaseCutoff = new Date(now() - CLAIM_LEASE_MS)
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: attempts.id, audioTries: attempts.audioTries })
      .from(attempts)
      .innerJoin(exams, eq(exams.id, attempts.examId))
      .where(
        and(
          sql`${exams.profile}->>'mode' = 'oral'`,
          inArray(attempts.status, ['ready_for_review', 'decided']),
          isNull(attempts.audioMergedAt),
          or(isNull(attempts.audioClaimedAt), lt(attempts.audioClaimedAt, leaseCutoff)),
          // Counted at the claim, so a merge that crashes the worker is not retried forever either.
          lt(attempts.audioTries, MAX_AUDIO_TRIES),
        ),
      )
      .limit(1)
      .for('update', { of: attempts, skipLocked: true })
    if (!row) return null
    await tx
      .update(attempts)
      .set({ audioClaimedAt: new Date(now()), audioTries: sql`${attempts.audioTries} + 1` })
      .where(eq(attempts.id, row.id))
    return row
  })
}

async function merge({ db, storage }: Deps, attemptId: string): Promise<string | null> {
  const parts: Buffer[] = []
  let size = 0
  let endsAt: number | null = null // when the sound so far ends, on the recording's clock
  for (const { hash, start } of await chunksInOrder(db, attemptId)) {
    if (size >= MAX_AUDIO_BYTES) break // the rest would be cut anyway: do not hold it in memory
    const chunk = await storage.get(blobKey(attemptId, hash))
    const sound = chunk ? await decodeAudio(chunk) : null
    if (!sound?.length) continue
    // Silence and sound both count towards the cap, so memory stays bounded whatever the gaps.
    if (endsAt !== null && start - endsAt > GAP_MS) {
      const gap = silence(Math.min(start - endsAt, ((MAX_AUDIO_BYTES - size) / BYTES_PER_SECOND) * 1000))
      parts.push(gap)
      size += gap.length
    }
    parts.push(sound.subarray(0, Math.max(0, MAX_AUDIO_BYTES - size)))
    size += Math.min(sound.length, Math.max(0, MAX_AUDIO_BYTES - size))
    endsAt = start + (sound.length / BYTES_PER_SECOND) * 1000
  }
  if (!size) return null
  const audio = await encodeOpus(Buffer.concat(parts))
  const hash = createHash('sha256').update(audio).digest('hex')
  await storage.put(blobKey(attemptId, hash), audio)
  await db
    .insert(blobs)
    .values({ attemptId, hash, mime: 'audio/webm', size: audio.length })
    .onConflictDoNothing()
  return hash
}

/** Every chunk of the attempt's fragments once, with when its recording started, in that order. */
export async function chunksInOrder(db: Db, attemptId: string): Promise<{ hash: string; start: number }[]> {
  const rows = await db
    .select({ data: events.data })
    .from(events)
    .where(and(eq(events.attemptId, attemptId), eq(events.type, 'evidence.fragment')))
  const startOf = new Map<string, number>()
  for (const { data } of rows) {
    const { chunks, chunkStarts } = data as { chunks: string[]; chunkStarts: number[] }
    chunks.forEach((hash, i) => startOf.has(hash) || startOf.set(hash, chunkStarts[i]!))
  }
  return [...startOf].map(([hash, start]) => ({ hash, start })).sort((a, b) => a.start - b.start)
}
