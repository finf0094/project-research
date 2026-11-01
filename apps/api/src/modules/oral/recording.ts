import type { AttemptDetail, CallEvent } from '@exam/contracts'
import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../../db/client.ts'
import { blobs, callEvents } from '../../db/schema.ts'
import { AUDIO_LEASE_MS, MAX_AUDIO_TRIES } from '../../media/audio.ts'

/**
 * What the examiner gets of an oral attempt besides the markers: the call's joins and leaves, and the whole
 * answer's merged audio and where it stands.
 */
export async function oralRecordingOf(
  db: Db,
  attempt: OralAttempt,
  now: number,
): Promise<{ call: CallEvent[]; audio: OralAudio }> {
  const call = await db
    .select({ who: callEvents.who, kind: callEvents.kind, at: callEvents.at })
    .from(callEvents)
    .where(eq(callEvents.attemptId, attempt.id))
    .orderBy(asc(callEvents.at), asc(callEvents.receivedAt))
  const [audio] = attempt.audioHash
    ? await db
        .select({ hash: blobs.hash })
        .from(blobs)
        .where(and(eq(blobs.attemptId, attempt.id), eq(blobs.hash, attempt.audioHash)))
    : []
  return { call: call.map((e) => ({ ...e, at: e.at.getTime() })), audio: audioState(attempt, !!audio, now) }
}

type OralAttempt = {
  id: string
  audioHash: string | null
  audioMergedAt: Date | null
  audioClaimedAt: Date | null
  audioTries: number
}
type OralAudio = NonNullable<AttemptDetail['audio']>

function audioState(attempt: OralAttempt, stored: boolean, now: number): OralAudio {
  if (attempt.audioHash)
    return stored ? { state: 'ready', hash: attempt.audioHash } : { state: 'removed', hash: null }
  if (attempt.audioMergedAt) return { state: 'empty', hash: null }
  // Out of tries without a result: given up (each try counts when the worker takes it).
  const working = attempt.audioClaimedAt && now - attempt.audioClaimedAt.getTime() < AUDIO_LEASE_MS
  return { state: attempt.audioTries >= MAX_AUDIO_TRIES && !working ? 'failed' : 'pending', hash: null }
}
