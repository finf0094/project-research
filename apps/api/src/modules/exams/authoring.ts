import type { AuthoredExam, ExamDefinition, ParticipantsResult } from '@exam/contracts'
import { and, asc, count, eq, inArray, notInArray } from 'drizzle-orm'
import type { Db, Tx } from '../../db/client.ts'
import { examExceptions } from './exceptions.ts'
import { attempts, examParticipants, examPreloads, exams, questions, users } from '../../db/schema.ts'
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

async function hasRows(db: Db | Tx, table: typeof attempts | typeof examPreloads, examId: string) {
  const [row] = await db.select({ n: count() }).from(table).where(eq(table.examId, examId))
  return (row?.n ?? 0) > 0
}

/**
 * Whether students may already be writing: an attempt exists, or the exam has opened and someone downloaded a
 * package (an offline attempt reaches the server only on its first sync, and its answers point at these
 * question ids). Before opening a download alone does not lock: an edit changes the code, so the outdated
 * package no longer opens and the device downloads the new one.
 */
async function isLocked(db: Db | Tx, exam: { id: string; opensAt: Date }, now: number) {
  if (await hasRows(db, attempts, exam.id)) return true
  return now >= exam.opensAt.getTime() && (await hasRows(db, examPreloads, exam.id))
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
 * Replaces the exam's settings and questions. Once students may be writing (see isLocked), the exam is
 * frozen: answers, tickets and the sealed event logs refer to exactly these questions. `now` is the
 * server's time (a parameter so tests can set it).
 */
export async function updateExam(
  db: Db,
  ownerId: string,
  examId: string,
  definition: ExamDefinition,
  now: number,
) {
  await db.transaction(async (tx) => {
    // FOR UPDATE also waits for a package download in progress (it locks the exam row), so its reservation
    // is seen here.
    const exam = await ownedExam(tx, ownerId, examId, true)
    if (await isLocked(tx, exam, now))
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

export async function authoredExam(
  db: Db,
  ownerId: string,
  examId: string,
  now: number,
): Promise<AuthoredExam> {
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
    locked: await isLocked(db, exam, now),
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
  now: number,
): Promise<ParticipantsResult> {
  const wanted = [...new Set(emails.map((e) => e.trim().toLowerCase()))]
  return db.transaction(async (tx) => {
    const exam = await ownedExam(tx, ownerId, examId, true)
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
    // Once it opened, a student holding a package may be writing offline (no attempt row until the first
    // sync): they stay, like those who started online, or their work would be refused.
    const offline =
      now >= exam.opensAt.getTime()
        ? await tx
            .select({ userId: examPreloads.userId })
            .from(examPreloads)
            .where(eq(examPreloads.examId, examId))
        : []
    const keep = new Set([
      ...students.map((s) => s.id),
      ...started.map((s) => s.userId),
      ...offline.map((s) => s.userId),
    ])
    // Only the difference changes, so a student who stays keeps their row and its individual exception.
    await tx
      .delete(examParticipants)
      .where(
        and(
          eq(examParticipants.examId, examId),
          keep.size ? notInArray(examParticipants.userId, [...keep]) : undefined,
        ),
      )
    if (keep.size)
      await tx
        .insert(examParticipants)
        .values([...keep].map((userId) => ({ examId, userId })))
        .onConflictDoNothing()
    const found = new Set(students.map((s) => s.email))
    return { participants: await participantEmails(tx, examId), unknown: wanted.filter((e) => !found.has(e)) }
  })
}
