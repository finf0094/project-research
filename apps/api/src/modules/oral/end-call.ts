import { RoomServiceClient } from 'livekit-server-sdk'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import { attempts, exams } from '../../db/schema.ts'
import type { Deps } from '../../deps.ts'
import { liveKitOf, roomOf, studentIdentity } from './service.ts'

/**
 * LiveKit checks a token only when someone joins, so a student already in the call would stay there after
 * the attempt ended. The database announces every change of an attempt (`attempt_updates`), whichever
 * process made it: the student's submit, the examiner's terminate command, the worker closing an overdue
 * attempt. Listening there is the one place that sees all of them. Returns the function that stops it.
 */
export async function watchEndedCalls(deps: Deps, log: FastifyBaseLogger) {
  // Without LiveKit endCall stops before any query; the settings are read per call, not at startup.
  const end = (attemptId: string) =>
    void endCall(deps, attemptId).catch((error: unknown) =>
      log.error({ err: error, attemptId }, 'could not remove the student from the oral exam room'),
    )
  return deps.listen(
    'attempt_updates',
    (payload) => {
      const attemptId = payload.split(':')[1]
      if (attemptId) end(attemptId)
    },
    // Announcements made while the connection was down are lost: end every call that may have ended then.
    () =>
      void (
        liveKitOf(deps) &&
        endedOralAttempts(deps)
          .then((ids) => ids.forEach(end))
          .catch((error: unknown) => log.error({ err: error }, 'could not check calls after a reconnect'))
      ),
  )
}

/** Oral attempts in the statuses an attempt ends in (before analysis moves them on): few at any time. */
async function endedOralAttempts(deps: Deps) {
  const rows = await deps.db
    .select({ id: attempts.id })
    .from(attempts)
    .innerJoin(exams, eq(exams.id, attempts.examId))
    .where(
      and(inArray(attempts.status, ['terminated', 'submitted']), sql`${exams.profile}->>'mode' = 'oral'`),
    )
  return rows.map((r) => r.id)
}

/**
 * Removes the student from the room of an oral attempt that has ended; otherwise does nothing. Later changes
 * of an ended attempt run this again, and then LiveKit finds nobody to remove.
 */
export async function endCall(deps: Deps, attemptId: string) {
  const liveKit = liveKitOf(deps)
  if (!liveKit) return
  const [ended] = await deps.db
    .select({ userId: attempts.userId })
    .from(attempts)
    .innerJoin(exams, eq(exams.id, attempts.examId))
    .where(
      and(
        eq(attempts.id, attemptId),
        // Only the statuses an attempt ends in; later ones (analysis, review) find the room long empty.
        inArray(attempts.status, ['terminated', 'submitted']),
        sql`${exams.profile}->>'mode' = 'oral'`,
      ),
    )
  if (!ended) return
  await new RoomServiceClient(liveKit.url, liveKit.key, liveKit.secret)
    .removeParticipant(roomOf(attemptId), studentIdentity(ended.userId))
    .catch((error: unknown) => {
      // Not in the room (already gone, or never joined) is what we wanted anyway.
      if ((error as { code?: string }).code !== 'not_found') throw error
    })
}
