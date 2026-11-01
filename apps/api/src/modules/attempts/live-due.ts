import { and, eq, sql } from 'drizzle-orm'
import type { Db, Tx } from '../../db/client.ts'
import { attempts } from '../../db/schema.ts'

/**
 * Asks the worker to rebuild a running attempt's markers (new signals or recordings arrived): its live
 * analysis picks the attempt up within seconds. An earlier ask is kept, so a steady stream is not delayed.
 * `at`: when it is due (now, or later for a retry).
 */
export async function markLiveDue(db: Db | Tx, attemptId: string, at: number) {
  await db
    .update(attempts)
    .set({ liveDueAt: sql`coalesce(${attempts.liveDueAt}, ${new Date(at).toISOString()}::timestamptz)` })
    .where(and(eq(attempts.id, attemptId), eq(attempts.status, 'active')))
}
