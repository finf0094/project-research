import type { OralRoomAccess } from '@exam/contracts'
import { AccessToken, TrackSource } from 'livekit-server-sdk'
import { eq } from 'drizzle-orm'
import { exams } from '../../db/schema.ts'
import type { Deps } from '../../deps.ts'
import { HttpError, conflict } from '../../shared/errors.ts'
import { ownAttempt } from '../attempts/service.ts'
import { ownAttemptOf } from '../review/access.ts'

/**
 * A token only lets someone join; an examiner who drops out mid-exam fetches a new one, so an hour is enough.
 * A student's token lasts only until the attempt's deadline.
 */
const EXAMINER_TTL_S = 3600

/** The live room of an oral attempt is named after the attempt: one student, one examiner. */
export const roomOf = (attemptId: string) => `attempt-${attemptId}`
const ROOM = /^attempt-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/

/** The attempt a room belongs to, or null for a room this app did not name. */
export const attemptOfRoom = (room: string) => ROOM.exec(room)?.[1] ?? null

/** The participant a student joins as; removing them from the room needs the same name. */
export const studentIdentity = (userId: string) => `student:${userId}`

/** LiveKit's address and credentials, or null while oral exams are not set up on this server. */
export function liveKitOf(deps: Deps) {
  const { LIVEKIT_URL: url, LIVEKIT_API_KEY: key, LIVEKIT_API_SECRET: secret } = deps.config
  return url && key && secret ? { url, key, secret } : null
}

async function issue(
  deps: Deps,
  identity: string,
  name: string,
  attemptId: string,
  ttl: number,
): Promise<OralRoomAccess> {
  const liveKit = liveKitOf(deps)
  if (!liveKit) throw new HttpError(503, 'Oral exams are not configured')
  const token = new AccessToken(liveKit.key, liveKit.secret, { identity, name, ttl })
  // Both sides only talk: a camera and a microphone, no screen and no data messages nobody would read.
  token.addGrant({
    room: roomOf(attemptId),
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
    canPublishData: false,
  })
  return { url: liveKit.url, token: await token.toJwt(), room: roomOf(attemptId) }
}

/** Seconds left of an attempt that is still running; a terminated or overdue one has nothing left to say. */
function secondsLeft(deps: Deps, attempt: { status: string; deadline: Date }) {
  const left = attempt.deadline.getTime() - deps.now()
  if (attempt.status !== 'active' || left <= 0) throw conflict('Attempt is not running')
  return Math.ceil(left / 1000)
}

/** The student joins only their own running oral attempt. */
export async function studentRoomAccess(deps: Deps, user: { id: string; name: string }, attemptId: string) {
  const attempt = await ownAttempt(deps.db, user.id, attemptId)
  const [exam] = await deps.db
    .select({ profile: exams.profile })
    .from(exams)
    .where(eq(exams.id, attempt.examId))
  if (exam?.profile.mode !== 'oral') throw conflict('Not an oral exam')
  return issue(deps, studentIdentity(user.id), user.name, attemptId, secondsLeft(deps, attempt))
}

/** The examiner joins rooms of running attempts of their own oral exams. */
export async function examinerRoomAccess(deps: Deps, user: { id: string; name: string }, attemptId: string) {
  const { attempt, exam } = await ownAttemptOf(deps.db, user.id, attemptId)
  if (exam.profile.mode !== 'oral') throw conflict('Not an oral exam')
  // Not capped at the deadline: the examiner may extend it while in the call.
  secondsLeft(deps, attempt)
  return issue(deps, `examiner:${user.id}`, user.name, attemptId, EXAMINER_TTL_S)
}
