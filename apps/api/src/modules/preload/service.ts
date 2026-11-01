import { randomBytes, randomUUID } from 'node:crypto'
import type { ExamPackage } from '@exam/contracts'
import { PACKAGE_ITERATIONS, formatStartCode, newStartCode, sealPackage } from '@exam/integrity'
import { and, eq } from 'drizzle-orm'
import type { Tx } from '../../db/client.ts'
import { attempts, examPreloads, exams } from '../../db/schema.ts'
import type { Deps } from '../../deps.ts'
import { decryptSecret, encryptSecret } from '../../shared/crypto.ts'
import { conflict, forbidden, notFound } from '../../shared/errors.ts'
import { isParticipant, studentExam } from '../exams/service.ts'

/** Packages can be downloaded from a day before the exam opens. */
export const PRELOAD_BEFORE_MS = 24 * 3_600_000

type ExamRow = typeof exams.$inferSelect

/**
 * The student's package for starting without network: the written exam sealed under its start code, with
 * the attempt id and chain key reserved for them. Downloaded again whenever the student is online, so an
 * edit (which changes the start code) replaces an outdated package.
 */
export async function examPackage(deps: Deps, userId: string, examId: string): Promise<ExamPackage> {
  const now = deps.now()
  const { exam, code, reservation, content } = await deps.db.transaction(async (tx) => {
    // FOR UPDATE: the first download creates the start code, exactly once.
    const [exam] = await tx.select().from(exams).where(eq(exams.id, examId)).for('update')
    if (!exam) throw notFound('Exam not found')
    if (!(await isParticipant(tx, examId, userId))) throw forbidden()
    if (exam.profile.mode !== 'written') throw conflict('Only written exams can start without network')
    if (now < exam.opensAt.getTime() - PRELOAD_BEFORE_MS || now >= exam.closesAt.getTime())
      throw conflict('The package is not available now')
    const [started] = await tx
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.examId, examId), eq(attempts.userId, userId)))
    if (started) throw conflict('The attempt has already started')
    const content = await studentExam(tx, examId, null)
    return {
      exam,
      code: await startCodeOf(deps, tx, exam),
      reservation: await reserve(deps, tx, examId, userId),
      content,
    }
  })
  // Sealing is slow on purpose (key stretching), so it runs after the transaction, not under its lock.
  const sealed = await sealPackage(JSON.stringify(content), code, examId, PACKAGE_ITERATIONS)
  return {
    examId,
    attemptId: reservation.attemptId,
    hmacKey: decryptSecret(deps.masterKey, reservation.hmacKeyEnc).toString('base64'),
    title: exam.title,
    durationMin: exam.durationMin,
    opensAt: exam.opensAt.getTime(),
    closesAt: exam.closesAt.getTime(),
    iterations: PACKAGE_ITERATIONS,
    sealed,
    serverTime: now,
  }
}

/** The exam's start code, created on first use (the caller holds the exam row lock). */
export async function startCodeOf(deps: Deps, tx: Tx, exam: ExamRow): Promise<string> {
  if (exam.startCodeEnc) return decryptSecret(deps.masterKey, exam.startCodeEnc).toString()
  const code = newStartCode()
  await tx
    .update(exams)
    .set({ startCodeEnc: encryptSecret(deps.masterKey, Buffer.from(code)) })
    .where(eq(exams.id, exam.id))
  return code
}

/** For the examiner to announce: the code, formatted for reading aloud. */
export async function examinerStartCode(deps: Deps, ownerId: string, examId: string) {
  return deps.db.transaction(async (tx) => {
    const [exam] = await tx
      .select()
      .from(exams)
      .where(and(eq(exams.id, examId), eq(exams.ownerId, ownerId)))
      .for('update')
    if (!exam) throw notFound('Exam not found')
    return { code: formatStartCode(await startCodeOf(deps, tx, exam)) }
  })
}

async function reserve(deps: Deps, tx: Tx, examId: string, userId: string) {
  await tx
    .insert(examPreloads)
    .values({
      examId,
      userId,
      attemptId: randomUUID(),
      hmacKeyEnc: encryptSecret(deps.masterKey, randomBytes(32)),
    })
    .onConflictDoNothing()
  const [row] = await tx
    .select()
    .from(examPreloads)
    .where(and(eq(examPreloads.examId, examId), eq(examPreloads.userId, userId)))
  return row!
}

/** The student's reservation, if they downloaded a package: the attempt then takes its id and key. */
export async function reservationOf(tx: Tx, examId: string, userId: string) {
  const [row] = await tx
    .select()
    .from(examPreloads)
    .where(and(eq(examPreloads.examId, examId), eq(examPreloads.userId, userId)))
  return row ?? null
}
