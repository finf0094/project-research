import { createHash } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { blobs, events } from '../../db/schema.ts'
import type { Deps } from '../../deps.ts'
import { badRequest, conflict, notFound } from '../../shared/errors.ts'
import { blobKey } from '../../shared/storage.ts'
import { ownAttempt } from '../attempts/service.ts'

export const MAX_CHUNK_BYTES = 5 * 1024 * 1024
export const ALLOWED_MIME = ['video/webm', 'audio/webm', 'video/mp4'] as const

/** Stores a recorded chunk. Only chunks announced in the attempt's sealed chain are accepted. */
export async function putChunk(
  deps: Deps,
  userId: string,
  attemptId: string,
  hash: string,
  mime: string,
  body: Buffer,
) {
  const attempt = await deps.db.transaction((tx) => ownAttempt(tx, userId, attemptId))
  const windowEnd = (attempt.submittedAt?.getTime() ?? Infinity) + deps.config.UPLOAD_WINDOW_HOURS * 3_600_000
  if (deps.now() > windowEnd || ['ready_for_review', 'decided'].includes(attempt.status)) {
    throw conflict('Upload window is closed')
  }

  const [stored] = await deps.db
    .select({ hash: blobs.hash })
    .from(blobs)
    .where(and(eq(blobs.attemptId, attemptId), eq(blobs.hash, hash)))
  if (stored) return // retried upload after a lost response

  const [announced] = await deps.db
    .select({ seq: events.seq })
    .from(events)
    .where(
      and(
        eq(events.attemptId, attemptId),
        eq(events.type, 'evidence.fragment'),
        sql`${events.data}->'chunks' ? ${hash}`,
      ),
    )
    .limit(1)
  if (!announced) throw notFound('Chunk is not referenced by any fragment')
  if (createHash('sha256').update(body).digest('hex') !== hash)
    throw badRequest('Body does not match its hash')

  await deps.storage.put(blobKey(attemptId, hash), body)
  await deps.db.insert(blobs).values({ attemptId, hash, mime, size: body.length }).onConflictDoNothing()
}
