import { createHash } from 'node:crypto'
import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { attempts, blobs, events, exams } from '../db/schema.ts'
import type { Deps } from '../deps.ts'
import { decodeAudio, encodeOpus } from '../media/audio.ts'
import { blobKey } from '../shared/storage.ts'

/** A claim older than this belongs to a worker that died. */
const CLAIM_LEASE_MS = 15 * 60_000

/**
 * merge-audio: once an oral attempt is analysed (its uploads are in or their window is over), joins the
 * sound of all its recorded chunks, in recording order, into one file the examiner can listen to in one go,
 * including what was said while the call was down. Chunks that are missing or unreadable are skipped.
 * Returns false when there is nothing to do.
 */
export async function mergeNextAudio(deps: Deps): Promise<boolean> {
  const attemptId = await claimNext(deps)
  if (!attemptId) return false
  let audioHash: string | null = null
  try {
    audioHash = await merge(deps, attemptId)
  } catch (error) {
    console.error(`audio of attempt ${attemptId} could not be merged`, error)
  }
  // Done either way: a failed merge is not retried forever; the chunks themselves stay playable.
  await deps.db
    .update(attempts)
    .set({ audioHash, audioMergedAt: new Date(deps.now()), audioClaimedAt: null })
    .where(eq(attempts.id, attemptId))
  return true
}

async function claimNext({ db, now }: Deps): Promise<string | null> {
  const leaseCutoff = new Date(now() - CLAIM_LEASE_MS)
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: attempts.id })
      .from(attempts)
      .innerJoin(exams, eq(exams.id, attempts.examId))
      .where(
        and(
          sql`${exams.profile}->>'mode' = 'oral'`,
          inArray(attempts.status, ['ready_for_review', 'decided']),
          isNull(attempts.audioMergedAt),
          or(isNull(attempts.audioClaimedAt), lt(attempts.audioClaimedAt, leaseCutoff)),
        ),
      )
      .limit(1)
      .for('update', { of: attempts, skipLocked: true })
    if (!row) return null
    await tx
      .update(attempts)
      .set({ audioClaimedAt: new Date(now()) })
      .where(eq(attempts.id, row.id))
    return row.id
  })
}

async function merge({ db, storage }: Deps, attemptId: string): Promise<string | null> {
  const pcm: Buffer[] = []
  for (const hash of await chunksInOrder(db, attemptId)) {
    const chunk = await storage.get(blobKey(attemptId, hash))
    if (!chunk) continue
    pcm.push(await decodeAudio(chunk).catch(() => Buffer.alloc(0)))
  }
  const sound = Buffer.concat(pcm)
  if (!sound.length) return null
  const audio = await encodeOpus(sound)
  const hash = createHash('sha256').update(audio).digest('hex')
  await storage.put(blobKey(attemptId, hash), audio)
  await db
    .insert(blobs)
    .values({ attemptId, hash, mime: 'audio/webm', size: audio.length })
    .onConflictDoNothing()
  return hash
}

/** Every uploaded chunk of the attempt's fragments once, ordered by when its recording started. */
export async function chunksInOrder(db: Db, attemptId: string): Promise<string[]> {
  const rows = await db
    .select({ data: events.data })
    .from(events)
    .where(and(eq(events.attemptId, attemptId), eq(events.type, 'evidence.fragment')))
  const startOf = new Map<string, number>()
  for (const { data } of rows) {
    const { chunks, chunkStarts } = data as { chunks: string[]; chunkStarts: number[] }
    chunks.forEach((hash, i) => startOf.has(hash) || startOf.set(hash, chunkStarts[i]!))
  }
  return [...startOf].sort((a, b) => a[1] - b[1]).map(([hash]) => hash)
}
