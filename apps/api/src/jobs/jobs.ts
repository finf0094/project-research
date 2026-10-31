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

/** Deletes recordings of decided attempts after the retention period; the event log itself is kept. */
export async function removeExpiredRecordings({ db, storage, config, now }: Deps): Promise<number> {
  const cutoff = new Date(now() - config.RETENTION_DAYS * 86_400_000)
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
  for (const row of rows) {
    await storage.remove(blobKey(row.attemptId, row.hash))
    await db.delete(blobs).where(and(eq(blobs.attemptId, row.attemptId), eq(blobs.hash, row.hash)))
  }
  return rows.length
}

export async function removeExpiredSessions({ db, now }: Deps): Promise<number> {
  const rows = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date(now())))
    .returning({ id: sessions.id })
  return rows.length
}
