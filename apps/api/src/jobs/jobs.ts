import { and, eq, inArray, lt, sql } from 'drizzle-orm'
import { attempts, blobs, decisions, sessions } from '../db/schema.ts'
import type { Deps } from '../deps.ts'
import { blobKey } from '../shared/storage.ts'

export { analyzeNext } from './analyze-next.ts'
export { mergeNextAudio } from './merge-audio.ts'

/** Attempts nobody submitted: once the offline window after the deadline is over, no answer can count anymore. */
export async function closeExpired({ db, config, now }: Deps): Promise<number> {
  const cutoff = new Date(now() - config.OFFLINE_WINDOW_MIN * 60_000)
  const rows = await db
    .update(attempts)
    .set({ status: 'submitted', submittedAt: new Date(now()) })
    .where(and(inArray(attempts.status, ['active', 'terminated']), lt(attempts.deadline, cutoff)))
    .returning({ id: attempts.id })
  return rows.length
}

/** Recordings deleted per query, so a large backlog never loads every row into memory at once. */
const RETENTION_BATCH = 500

/**
 * Deletes recordings N days after the decision (section 18), the event log itself is kept. Only decided
 * attempts: one still waiting for review keeps its evidence however long the examiner's backlog is, and
 * a later decision (another review) restarts the period.
 */
export async function removeExpiredRecordings({ db, storage, config, now }: Deps): Promise<number> {
  const cutoff = new Date(now() - config.RETENTION_DAYS * 86_400_000)
  let removed = 0
  for (;;) {
    const rows = await db
      .select({ attemptId: blobs.attemptId, hash: blobs.hash })
      .from(blobs)
      .innerJoin(attempts, eq(attempts.id, blobs.attemptId))
      .where(
        and(
          eq(attempts.status, 'decided'),
          sql`(select max(${decisions.decidedAt}) from ${decisions} where ${decisions.attemptId} = ${attempts.id}) < ${cutoff.toISOString()}::timestamptz`,
        ),
      )
      .limit(RETENTION_BATCH)
    for (const row of rows) {
      await storage.remove(blobKey(row.attemptId, row.hash))
      await db.delete(blobs).where(and(eq(blobs.attemptId, row.attemptId), eq(blobs.hash, row.hash)))
    }
    removed += rows.length
    // Deleted rows drop out of the query, so the next batch starts where this one ended.
    if (rows.length < RETENTION_BATCH) return removed
  }
}

export async function removeExpiredSessions({ db, now }: Deps): Promise<number> {
  const rows = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date(now())))
    .returning({ id: sessions.id })
  return rows.length
}
