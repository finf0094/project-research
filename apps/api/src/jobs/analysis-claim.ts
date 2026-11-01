import { and, asc, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { attempts, blobs, events } from '../db/schema.ts'
import type { Deps } from '../deps.ts'

/** A claim older than this belongs to a worker that died; another worker may take the attempt. */
const CLAIM_LEASE_MS = 15 * 60_000

/** The oldest submitted attempt ready for its final analysis, claimed (SKIP LOCKED: workers side by side). */
export async function claimNext({ db, config, now }: Deps) {
  const uploadCutoff = new Date(now() - config.UPLOAD_WINDOW_HOURS * 3_600_000)
  const leaseCutoff = new Date(now() - CLAIM_LEASE_MS)
  // True when every chunk announced in the chain has been uploaded.
  const allChunksUploaded = sql`not exists (
    select 1 from ${events} e
    cross join lateral jsonb_array_elements_text(e.data->'chunks') as chunk(hash)
    where e.attempt_id = ${attempts.id} and e.type = 'evidence.fragment'
      and not exists (select 1 from ${blobs} b where b.attempt_id = e.attempt_id and b.hash = chunk.hash))`

  return db.transaction(async (tx) => {
    const [attempt] = await tx
      .select()
      .from(attempts)
      .where(
        and(
          eq(attempts.status, 'submitted'),
          or(isNull(attempts.analysisClaimedAt), lt(attempts.analysisClaimedAt, leaseCutoff)),
          or(lt(attempts.submittedAt, uploadCutoff), allChunksUploaded),
        ),
      )
      .orderBy(asc(attempts.submittedAt))
      .limit(1)
      .for('update', { skipLocked: true })
    if (!attempt) return null
    await tx
      .update(attempts)
      .set({ analysisClaimedAt: new Date(now()) })
      .where(eq(attempts.id, attempt.id))
    return attempt
  })
}

// A missed renewal only risks a second worker later: it must never throw away the findings so far.
export const renewClaim = ({ db, now }: Deps, attemptId: string) =>
  db
    .update(attempts)
    .set({ analysisClaimedAt: new Date(now()) })
    .where(eq(attempts.id, attemptId))
    .then(
      () => undefined,
      (error: unknown) => console.error(`could not renew the analysis claim of ${attemptId}`, error),
    )
