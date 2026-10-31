import type { AttemptBase, NetState } from '@exam/contracts'
import { and, eq } from 'drizzle-orm'
import type { Db, Tx } from '../../db/client.ts'
import { attempts, exams } from '../../db/schema.ts'
import { notFound } from '../../shared/errors.ts'

/** A student that has not synced for this long is shown as offline, whatever its last reported state. */
const SILENCE_MS = 30_000

// Ownership checks shared by the examiner endpoints: an examiner sees only their own exams.

export async function ownExam(db: Db | Tx, ownerId: string, examId: string) {
  const [exam] = await db
    .select()
    .from(exams)
    .where(and(eq(exams.id, examId), eq(exams.ownerId, ownerId)))
  if (!exam) throw notFound('Exam not found')
  return exam
}

export async function ownAttemptOf(db: Db | Tx, ownerId: string, attemptId: string, lock = false) {
  const query = db
    .select({ attempt: attempts, exam: exams })
    .from(attempts)
    .innerJoin(exams, eq(exams.id, attempts.examId))
    .where(and(eq(attempts.id, attemptId), eq(exams.ownerId, ownerId)))
  const [row] = lock ? await query.for('update', { of: attempts }) : await query
  if (!row) throw notFound('Attempt not found')
  return row
}

export function toSummary(
  attempt: typeof attempts.$inferSelect,
  studentName: string,
  answered: number,
  markerCount: number,
  now: number,
): AttemptBase {
  const running = attempt.status === 'active' || attempt.status === 'terminated'
  const silent = now - attempt.lastSeenAt.getTime() > SILENCE_MS
  const connection: NetState | null = running ? (silent ? 'offline' : (attempt.connection ?? 'online')) : null
  return {
    id: attempt.id,
    student: { id: attempt.userId, name: studentName },
    status: attempt.status,
    startedAt: attempt.startedAt.getTime(),
    lastSeenAt: attempt.lastSeenAt.getTime(),
    connection,
    answered,
    markerCount,
    riskScore: attempt.riskScore,
  }
}
