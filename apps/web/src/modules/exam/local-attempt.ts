import type { AttemptSession } from '@exam/contracts'
import { importHmacKeyBase64 } from '@exam/integrity'
import { db, type LocalAttempt } from '@/modules/offline'
import { fetchAttempt, startAttempt } from './api'

/**
 * Stores what the server sent so the attempt keeps working offline and after reloads.
 * The HMAC key is imported as a non-extractable CryptoKey; the base64 copy is not kept.
 */
async function saveSession(session: AttemptSession): Promise<LocalAttempt> {
  const existing = await db.attempts.get(session.attemptId)
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
    finishing: false,
  }
  await db.transaction('rw', db.attempts, db.answers, async () => {
    await db.attempts.put(attempt)
    await db.answers.bulkPut(
      Object.entries(session.answers).map(([questionId, value]) => ({
        attemptId: attempt.id,
        questionId,
        value,
      })),
    )
  })
  return attempt
}

export async function beginAttempt(examId: string): Promise<LocalAttempt> {
  return saveSession(await startAttempt(examId))
}

/** Local copy first (works offline); the server copy only if this device has never seen the attempt. */
export async function loadAttempt(attemptId: string): Promise<LocalAttempt> {
  return (await db.attempts.get(attemptId)) ?? saveSession(await fetchAttempt(attemptId))
}

export async function localAnswers(attemptId: string) {
  const rows = await db.answers
    .where('[attemptId+questionId]')
    .between([attemptId, ''], [attemptId, '￿'])
    .toArray()
  return Object.fromEntries(rows.map((r) => [r.questionId, r.value]))
}
