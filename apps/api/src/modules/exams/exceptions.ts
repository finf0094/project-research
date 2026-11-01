import type { SignalException, SignalKind } from '@exam/contracts'
import { and, asc, eq, sql } from 'drizzle-orm'
import type { Db, Tx } from '../../db/client.ts'
import { examParticipants, exams, users } from '../../db/schema.ts'
import { badRequest, notFound } from '../../shared/errors.ts'

/**
 * Section 25.3: individual exceptions — signals not watched for one student (special needs). Set by the
 * exam's examiner per participant; the device does not raise them and the analysis sets no markers for them.
 */
export async function examExceptions(db: Db | Tx, examId: string): Promise<SignalException[]> {
  const rows = await db
    .select({ email: users.email, disabledSignals: examParticipants.disabledSignals })
    .from(examParticipants)
    .innerJoin(users, eq(users.id, examParticipants.userId))
    .where(
      and(eq(examParticipants.examId, examId), sql`cardinality(${examParticipants.disabledSignals}) > 0`),
    )
    .orderBy(asc(users.email))
  return rows
}

export async function setException(db: Db, ownerId: string, examId: string, exception: SignalException) {
  const [exam] = await db
    .select({ id: exams.id })
    .from(exams)
    .where(and(eq(exams.id, examId), eq(exams.ownerId, ownerId)))
  if (!exam) throw notFound('Exam not found')
  const [student] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, exception.email.toLowerCase()))
  const updated = student
    ? await db
        .update(examParticipants)
        .set({ disabledSignals: [...new Set(exception.disabledSignals)] })
        .where(and(eq(examParticipants.examId, examId), eq(examParticipants.userId, student.id)))
        .returning({ userId: examParticipants.userId })
    : []
  if (!updated.length) throw badRequest('Not a participant of this exam')
}

/** The signals not watched for this student in this exam. */
export async function disabledSignalsOf(db: Db | Tx, examId: string, userId: string): Promise<SignalKind[]> {
  const [row] = await db
    .select({ disabledSignals: examParticipants.disabledSignals })
    .from(examParticipants)
    .where(and(eq(examParticipants.examId, examId), eq(examParticipants.userId, userId)))
  return row?.disabledSignals ?? []
}
