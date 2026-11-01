import { and, eq } from 'drizzle-orm'
import type { Db, Tx } from '../db/client.ts'
import { blobs, chunkObservations, events } from '../db/schema.ts'
import type { Observation } from '../ml/observations.ts'
import type { Fragment } from '../ml/recordings.ts'

/** The recorded fragments the device announced in its log. */
export async function fragmentsOf(db: Db, attemptId: string) {
  const rows = await db
    .select({ data: events.data })
    .from(events)
    .where(and(eq(events.attemptId, attemptId), eq(events.type, 'evidence.fragment')))
  return rows.map((r) => r.data as Fragment)
}

export async function uploadedOf(db: Db | Tx, attemptId: string) {
  const rows = await db.select({ hash: blobs.hash }).from(blobs).where(eq(blobs.attemptId, attemptId))
  return new Set(rows.map((b) => b.hash))
}

/** What the server's models already saw, per chunk (from the live analysis during the exam). */
export async function observationsOf(db: Db | Tx, attemptId: string) {
  const rows = await db
    .select({ hash: chunkObservations.hash, observations: chunkObservations.observations })
    .from(chunkObservations)
    .where(eq(chunkObservations.attemptId, attemptId))
  // Rows cached before the server listened to the sound have no `loud`: they count as quiet.
  return new Map(
    rows.map((row) => [
      row.hash,
      row.observations.map((o): Observation => ({ ...o, loud: o.loud ?? false })),
    ]),
  )
}
