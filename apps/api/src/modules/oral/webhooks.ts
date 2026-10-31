import { WebhookReceiver } from 'livekit-server-sdk'
import type { CallRole } from '@exam/contracts'
import { eq } from 'drizzle-orm'
import { attempts, callEvents } from '../../db/schema.ts'
import type { Deps } from '../../deps.ts'
import { HttpError, unauthorized } from '../../shared/errors.ts'
import { attemptOfRoom } from './service.ts'

const KINDS = { participant_joined: 'joined', participant_left: 'left' } as const

/**
 * Records LiveKit's "joined"/"left" webhooks of an oral exam's call as events of its attempt, so the examiner
 * sees when the connection dropped and for how long. The signature (a JWT signed with the API secret,
 * covering the body's hash) is checked first; anything else LiveKit reports is ignored.
 */
export async function recordCallEvent(deps: Deps, body: string, authorization: string | undefined) {
  const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = deps.config
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) throw new HttpError(503, 'Oral exams are not configured')
  const event = await new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    .receive(body, authorization)
    .catch(() => {
      throw unauthorized()
    })

  const kind = KINDS[event.event as keyof typeof KINDS]
  const attemptId = attemptOfRoom(event.room?.name ?? '')
  const who = roleOf(event.participant?.identity ?? '')
  if (!kind || !attemptId || !who || !event.id) return
  const [attempt] = await deps.db.select({ id: attempts.id }).from(attempts).where(eq(attempts.id, attemptId))
  if (!attempt) return
  // createdAt is in seconds; a redelivered webhook keeps its id and is stored once.
  const at = event.createdAt ? Number(event.createdAt) * 1000 : deps.now()
  await deps.db
    .insert(callEvents)
    .values({ id: event.id, attemptId, who, kind, at: new Date(at) })
    .onConflictDoNothing()
}

/** Token identities are "student:<id>" or "examiner:<id>" (see service.ts). */
function roleOf(identity: string): CallRole | null {
  const role = identity.split(':')[0]
  return role === 'student' || role === 'examiner' ? role : null
}
