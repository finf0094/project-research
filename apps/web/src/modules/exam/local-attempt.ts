import type { AttemptSession } from '@exam/contracts'
import { importHmacKeyBase64 } from '@exam/integrity'
import { getAttempt, saveAttempt, type LocalAttempt } from '@/modules/offline'
import { fetchAttempt, startAttempt } from './api'

/**
 * Stores what the server sent so the attempt keeps working offline and after reloads.
 * The HMAC key is imported as a non-extractable CryptoKey; the base64 copy is not kept.
 */
async function saveSession(session: AttemptSession): Promise<LocalAttempt> {
  const existing = await getAttempt(session.attemptId)
  if (existing) return existing
  const attempt: LocalAttempt = {
    id: session.attemptId,
    exam: session.exam,
    key: await importHmacKeyBase64(session.hmacKey),
    head: { seq: session.ackedSeq, hash: session.lastHash },
    ackedSeq: session.ackedSeq,
    deadline: session.deadline,
    status: session.status,
    clockOffset: session.serverTime - Date.now(),
    endedBy: null,
  }
  await saveAttempt(attempt, session.answers)
  return attempt
}

export async function beginAttempt(examId: string): Promise<LocalAttempt> {
  return saveSession(await startAttempt(examId))
}

/** Local copy first (works offline); the server copy only if this device has never seen the attempt. */
export async function loadAttempt(attemptId: string): Promise<LocalAttempt> {
  return (await getAttempt(attemptId)) ?? saveSession(await fetchAttempt(attemptId))
}
