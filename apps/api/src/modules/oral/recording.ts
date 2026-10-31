import type { CallEvent } from '@exam/contracts'
import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../../db/client.ts'
import { blobs, callEvents } from '../../db/schema.ts'

/**
 * What the examiner gets of an oral attempt besides the markers: the call's joins and leaves, and the whole
 * answer's merged audio (null until the worker merged it, or once it was deleted after retention).
 */
export async function oralRecordingOf(
  db: Db,
  attempt: { id: string; audioHash: string | null },
): Promise<{ call: CallEvent[]; audio: string | null }> {
  const call = await db
    .select({ who: callEvents.who, kind: callEvents.kind, at: callEvents.at })
    .from(callEvents)
    .where(eq(callEvents.attemptId, attempt.id))
    .orderBy(asc(callEvents.at))
  const [audio] = attempt.audioHash
    ? await db
        .select({ hash: blobs.hash })
        .from(blobs)
        .where(and(eq(blobs.attemptId, attempt.id), eq(blobs.hash, attempt.audioHash)))
    : []
  return { call: call.map((e) => ({ ...e, at: e.at.getTime() })), audio: audio?.hash ?? null }
}
