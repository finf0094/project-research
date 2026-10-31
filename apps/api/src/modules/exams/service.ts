import type { Question, StudentExam, StudentExamListItem } from '@exam/contracts'
import { and, asc, count, eq } from 'drizzle-orm'
import type { Db, Tx } from '../../db/client.ts'
import { attempts, examParticipants, exams, questions } from '../../db/schema.ts'

export async function listForStudent(db: Db, userId: string): Promise<StudentExamListItem[]> {
  const rows = await db
    .select({
      exam: exams,
      questionCount: db.$count(questions, eq(questions.examId, exams.id)),
      attemptId: attempts.id,
      attemptStatus: attempts.status,
    })
    .from(examParticipants)
    .innerJoin(exams, eq(exams.id, examParticipants.examId))
    .leftJoin(attempts, and(eq(attempts.examId, exams.id), eq(attempts.userId, userId)))
    .where(eq(examParticipants.userId, userId))
    .orderBy(asc(exams.opensAt))
  return rows.map(({ exam, questionCount, attemptId, attemptStatus }) => ({
    id: exam.id,
    title: exam.title,
    mode: exam.profile.mode,
    durationMin: exam.durationMin,
    opensAt: exam.opensAt.getTime(),
    closesAt: exam.closesAt.getTime(),
    questionCount:
      exam.profile.mode === 'oral' ? Math.min(questionCount, exam.profile.ticketSize ?? 3) : questionCount,
    attempt: attemptId && attemptStatus ? { id: attemptId, status: attemptStatus } : null,
  }))
}

export async function isParticipant(db: Db | Tx, examId: string, userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(examParticipants)
    .where(and(eq(examParticipants.examId, examId), eq(examParticipants.userId, userId)))
  return (row?.n ?? 0) > 0
}

export async function examQuestions(db: Db | Tx, examId: string) {
  return db.select().from(questions).where(eq(questions.examId, examId)).orderBy(asc(questions.position))
}

/** Questions of an attempt: the whole exam, or only the ticket drawn for an oral attempt (in ticket order). */
export async function attemptQuestions(db: Db | Tx, examId: string, ticket: string[] | null) {
  const rows = await examQuestions(db, examId)
  if (!ticket) return rows
  const byId = new Map(rows.map((q) => [q.id, q]))
  return ticket.flatMap((id) => byId.get(id) ?? [])
}

/** The exam as the student sees it: no correct answers, and for an oral exam only the drawn ticket. */
export async function studentExam(
  db: Db | Tx,
  examId: string,
  ticket: string[] | null,
): Promise<StudentExam | null> {
  const [exam] = await db.select().from(exams).where(eq(exams.id, examId))
  if (!exam) return null
  const rows = await attemptQuestions(db, examId, ticket)
  return {
    id: exam.id,
    title: exam.title,
    durationMin: exam.durationMin,
    opensAt: exam.opensAt.getTime(),
    closesAt: exam.closesAt.getTime(),
    profile: exam.profile,
    questions: rows.map(toStudentQuestion),
  }
}

export function toStudentQuestion(row: typeof questions.$inferSelect): Question {
  return { id: row.id, type: row.type, text: row.text, options: row.options, points: row.points }
}
