import type { AttemptStatus, SyncResponse } from '@exam/contracts'
import { updateAttempt } from '@/modules/offline'
import { ApiError } from '@/shared/lib/http'
import { submitAttempt } from './api'
import type { ExamSession } from './exam-session'

export type SubmitOutcome = { status: AttemptStatus } | 'waiting' | 'signed-out'

/**
 * Submits once the server holds the whole chain (or the chain is broken and nothing more can count).
 * `waiting`: the next sync delivers the rest, or the submit is retried after it.
 */
export async function submitWhenDelivered(
  session: ExamSession,
  response: SyncResponse,
): Promise<SubmitOutcome> {
  const head = session.log.head()
  if (response.ackedSeq < head.seq && !response.chainBroken) return 'waiting'
  try {
    const { status } = await submitAttempt(session.attemptId, { lastSeq: head.seq, lastHash: head.hash })
    await updateAttempt(session.attemptId, { status })
    return { status }
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return 'signed-out'
    // 409: an event appended meanwhile is still on its way; network errors: retried after the next sync.
    if (error instanceof ApiError && error.status !== 409) console.error('submit refused', error)
    return 'waiting'
  }
}
