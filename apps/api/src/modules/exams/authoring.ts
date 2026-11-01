import type { AuthoredExam, ExamDefinition, ParticipantsResult } from '@exam/contracts'
import { and, asc, count, eq, inArray } from 'drizzle-orm'
import type { Db, Tx } from '../../db/client.ts'
import { examExceptions } from './exceptions.ts'
import { attempts, examParticipants, exams, questions, users } from '../../db/schema.ts'
import { conflict, notFound } from '../../shared/errors.ts'

/** The exam, if this examiner owns it; FOR UPDATE inside a transaction that changes it. */
async function ownedExam(db: Db | Tx, ownerId: string, examId: string, forUpdate = false) {
  const query = db
    .select()
    .from(exams)
    .where(and(eq(exams.id, examId), eq(exams.ownerId, ownerId)))
  const [exam] = forUpdate ? await query.for('update') : await query
  if (!exam) throw notFound('Exam not found')
  return exam
}

async function hasAttempts(db: Db | Tx, examId: string) {
  const [row] = await db.select({ n: count() }).from(attempts).where(eq(attempts.examId, examId))
  return (row?.n ?? 0) > 0
}

const examColumns = (d: ExamDefinition) => ({
  title: d.title,
  durationMin: d.durationMin,
  opensAt: new Date(d.opensAt),
  closesAt: new Date(d.closesAt),
  profile: d.profile,
})

async function insertQuestions(tx: Tx, examId: string, d: ExamDefinition) {
  await tx.insert(questions).values(d.questions.map((q, i) => ({ ...q, examId, position: i + 1 })))
}

export async function createExam(db: Db, ownerId: string, definition: ExamDefinition) {
  return db.transaction(async (tx) => {
    const [exam] = await tx
      .insert(exams)
      .values({ ...examColumns(definition), ownerId })
      .returning({ id: exams.id })
    await insertQuestions(tx, exam!.id, definition)
    return { id: exam!.id }
  })
}

/**
 * Replaces the exam's settings and questions. Once a student has started, the exam is frozen: answers,
 * tickets and the sealed event logs refer to exactly these questions.
 */
export async function updateExam(db: Db, ownerId: string, examId: string, definition: ExamDefinition) {
  await db.transaction(async (tx) => {
    await ownedExam(tx, ownerId, examId, true)
    if (await hasAttempts(tx, examId))
      throw conflict('Students have started this exam; it can no longer change')
    // Questions are recreated with new ids: downloaded packages are outdated, so their code stops working
    // (a new one is made on the next download).
    await tx
      .update(exams)
      .set({ ...examColumns(definition), startCodeEnc: null })
      .where(eq(exams.id, examId))
    await tx.delete(questions).where(eq(questions.examId, examId))
    await insertQuestions(tx, examId, definition)
  })
}

export async function authoredExam(db: Db, ownerId: string, examId: string): Promise<AuthoredExam> {
  const exam = await ownedExam(db, ownerId, examId)
  const rows = await db
    .select()
    .from(questions)
    .where(eq(questions.examId, examId))
    .orderBy(asc(questions.position))
  return {
    id: exam.id,
    definition: {
      title: exam.title,
      durationMin: exam.durationMin,
      opensAt: exam.opensAt.getTime(),
      closesAt: exam.closesAt.getTime(),
      profile: exam.profile,
      questions: rows.map(({ type, text, options, correct, points }) => ({
        type,
        text,
        options,
        correct,
        points,
      })),
    },
    locked: await hasAttempts(db, examId),
    participants: await participantEmails(db, examId),
    exceptions: await examExceptions(db, examId),
  }
}

async function participantEmails(db: Db | Tx, examId: string) {
  const rows = await db
    .select({ email: users.email })
    .from(examParticipants)
    .innerJoin(users, eq(users.id, examParticipants.userId))
    .where(eq(examParticipants.examId, examId))
    .orderBy(asc(users.email))
  return rows.map((r) => r.email)
}

/**
 * Sets who may take the exam (any time, also while it runs). Unknown emails are reported, not created;
 * a student who has already started stays on the list.
 */
export async function setParticipants(
  db: Db,
  ownerId: string,
  examId: string,
  emails: string[],
): Promise<ParticipantsResult> {
  const wanted = [...new Set(emails.map((e) => e.trim().toLowerCase()))]
  return db.transaction(async (tx) => {
    await ownedExam(tx, ownerId, examId, true)
    const students = wanted.length
      ? await tx
          .select({ id: users.id, email: users.email })
          .from(users)
          .where(and(inArray(users.email, wanted), eq(users.role, 'student')))
      : []
    const started = await tx
      .select({ userId: attempts.userId })
      .from(attempts)
      .where(eq(attempts.examId, examId))
    const keep = new Set([...students.map((s) => s.id), ...started.map((s) => s.userId)])
    // A student who stays keeps their individual exception.
    const before = await tx.select().from(examParticipants).where(eq(examParticipants.examId, examId))
    const exceptionOf = new Map(before.map((p) => [p.userId, p.disabledSignals]))
    await tx.delete(examParticipants).where(eq(examParticipants.examId, examId))
    if (keep.size)
      await tx
        .insert(examParticipants)
        .values(
          [...keep].map((userId) => ({ examId, userId, disabledSignals: exceptionOf.get(userId) ?? [] })),
        )
    const found = new Set(students.map((s) => s.email))
    return { participants: await participantEmails(tx, examId), unknown: wanted.filter((e) => !found.has(e)) }
  })
}
