import type { OralRoomAccess } from '@exam/contracts'
import { AccessToken } from 'livekit-server-sdk'
import { eq } from 'drizzle-orm'
import { exams } from '../../db/schema.ts'
import type { Deps } from '../../deps.ts'
import { HttpError, conflict } from '../../shared/errors.ts'
import { ownAttempt } from '../attempts/service.ts'
import { ownAttemptOf } from '../review/access.ts'

/** Examiner tokens; a student's token lasts only until the attempt's deadline. */
const EXAMINER_TTL_S = 2 * 3600

/** The live room of an oral attempt is named after the attempt: one student, one examiner. */
const roomOf = (attemptId: string) => `attempt-${attemptId}`
const ROOM = /^attempt-([0-9a-f-]{36})$/

/** The attempt a room belongs to, or null for a room this app did not name. */
export const attemptOfRoom = (room: string) => ROOM.exec(room)?.[1] ?? null

async function issue(
  deps: Deps,
  identity: string,
  name: string,
  attemptId: string,
  ttl = EXAMINER_TTL_S,
): Promise<OralRoomAccess> {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = deps.config
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET)
    throw new HttpError(503, 'Oral exams are not configured')
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name, ttl })
  token.addGrant({ room: roomOf(attemptId), roomJoin: true, canPublish: true, canSubscribe: true })
  return { url: LIVEKIT_URL, token: await token.toJwt(), room: roomOf(attemptId) }
}

/** The student joins only their own running oral attempt. */
export async function studentRoomAccess(deps: Deps, user: { id: string; name: string }, attemptId: string) {
  const attempt = await ownAttempt(deps.db, user.id, attemptId)
  const [exam] = await deps.db
    .select({ profile: exams.profile })
    .from(exams)
    .where(eq(exams.id, attempt.examId))
  if (exam?.profile.mode !== 'oral') throw conflict('Not an oral exam')
  // A terminated attempt or one past its deadline has nothing left to say on the call.
  const left = attempt.deadline.getTime() - deps.now()
  if (attempt.status !== 'active' || left <= 0) throw conflict('Attempt is not running')
  return issue(deps, `student:${user.id}`, user.name, attemptId, Math.ceil(left / 1000))
}

/** The examiner joins rooms of attempts of their own oral exams. */
export async function examinerRoomAccess(deps: Deps, user: { id: string; name: string }, attemptId: string) {
  const { exam } = await ownAttemptOf(deps.db, user.id, attemptId)
  if (exam.profile.mode !== 'oral') throw conflict('Not an oral exam')
  return issue(deps, `examiner:${user.id}`, user.name, attemptId)
}
