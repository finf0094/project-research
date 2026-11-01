import { StudentExam } from '@exam/contracts'
import { genesisHash, openPackage } from '@exam/integrity'
import { deletePackage, saveAttempt, type LocalAttempt, type StoredPackage } from '@/modules/offline'

/** The start code did not open the package (mistyped, or the exam changed since it was downloaded). */
export class WrongStartCode extends Error {}

/**
 * Begins an attempt with no network: opens the downloaded package with the start code the proctor
 * announced, and keeps the attempt on this device exactly as if the server had started it — the reserved
 * id and chain key, the time from the package's clock. The server creates it at the first sync.
 */
export async function startOffline(pkg: StoredPackage, code: string): Promise<LocalAttempt> {
  const text = await openPackage(pkg.sealed, code, pkg.examId, pkg.iterations).catch(() => {
    throw new WrongStartCode()
  })
  const now = Date.now() + pkg.clockOffset
  // No refusal by this device's clock: it may be wrong, and the server pulls the start into the window.
  const exam = StudentExam.parse(JSON.parse(text))
  const attempt: LocalAttempt = {
    id: pkg.attemptId,
    exam,
    key: pkg.key,
    head: { seq: 0, hash: await genesisHash(pkg.attemptId) },
    ackedSeq: 0,
    deadline: Math.min(now + pkg.durationMin * 60_000, pkg.closesAt),
    status: 'active',
    clockOffset: pkg.clockOffset,
    endedBy: null,
    offlineStart: { examId: pkg.examId, startedAt: now },
    disabledSignals: pkg.disabledSignals,
  }
  await saveAttempt(attempt, {})
  // The key is in the attempt now; the package is not needed (nor wanted) any longer.
  await deletePackage(pkg.userId, pkg.examId)
  return attempt
}
