import type { OralRoomAccess } from '@exam/contracts'
import { AccessToken } from 'livekit-server-sdk'
import { eq } from 'drizzle-orm'
import { exams } from '../../db/schema.ts'
import type { Deps } from '../../deps.ts'
import { HttpError, conflict } from '../../shared/errors.ts'
import { OPEN_STATUSES, ownAttempt } from '../attempts/service.ts'
import { ownAttemptOf } from '../review/access.ts'

const TOKEN_TTL = '2h'

/** The live room of an oral attempt is named after the attempt: one student, one examiner. */
const roomOf = (attemptId: string) => `attempt-${attemptId}`

async function issue(deps: Deps, identity: string, name: string, attemptId: string): Promise<OralRoomAccess> {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = deps.config
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) throw new HttpError(503, 'Oral exams are not configured')
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name, ttl: TOKEN_TTL })
  token.addGrant({ room: roomOf(attemptId), roomJoin: true, canPublish: true, canSubscribe: true })
  return { url: LIVEKIT_URL, token: await token.toJwt(), room: roomOf(attemptId) }
}

/** The student joins only their own running oral attempt. */
export async function studentRoomAccess(deps: Deps, user: { id: string; name: string }, attemptId: string) {
  const attempt = await ownAttempt(deps.db, user.id, attemptId)
  const [exam] = await deps.db.select({ profile: exams.profile }).from(exams).where(eq(exams.id, attempt.examId))
  if (exam?.profile.mode !== 'oral') throw conflict('Not an oral exam')
  if (!OPEN_STATUSES.includes(attempt.status)) throw conflict('Attempt is not running')
  return issue(deps, `student:${user.id}`, user.name, attemptId)
}

/** The examiner joins rooms of attempts of their own oral exams. */
export async function examinerRoomAccess(deps: Deps, user: { id: string; name: string }, attemptId: string) {
  const { exam } = await ownAttemptOf(deps.db, user.id, attemptId)
  if (exam.profile.mode !== 'oral') throw conflict('Not an oral exam')
  return issue(deps, `examiner:${user.id}`, user.name, attemptId)
}
