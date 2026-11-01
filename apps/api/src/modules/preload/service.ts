import { randomBytes, randomUUID } from 'node:crypto'
import type { ExamPackage } from '@exam/contracts'
import {
  PACKAGE_ITERATIONS,
  formatStartCode,
  newStartCode,
  sealPackage,
  type SealedPackage,
} from '@exam/integrity'
import { and, eq, isNull } from 'drizzle-orm'
import type { Db, Tx } from '../../db/client.ts'
import { attempts, examPreloads, exams } from '../../db/schema.ts'
import type { Deps } from '../../deps.ts'
import { decryptSecret, encryptSecret } from '../../shared/crypto.ts'
import { conflict, forbidden, notFound } from '../../shared/errors.ts'
import { disabledSignalsOf } from '../exams/exceptions.ts'
import { offlineCapable, packageVersion } from '../exams/offline.ts'
import { isParticipant, studentExam } from '../exams/service.ts'

/** Packages are offered from a day before the sitting until it opens (after that, students start online). */
const PRELOAD_BEFORE_MS = 24 * 3_600_000

type ExamRow = typeof exams.$inferSelect
/**
 * The student's package: the sitting's questions sealed under its start code, and the attempt id and chain
 * key reserved for them. The sealed content is the same for everyone, so it is made once per code.
 */
export async function examPackage(deps: Deps, userId: string, examId: string): Promise<ExamPackage> {
  // The checks and the reservation run under one exam row lock. FOR UPDATE, not FOR SHARE: two shared locks
  // do not wait for each other, and an online start (FOR SHARE) must either see this reservation and take
  // its attempt id, or have created its attempt before we check. An edit (also FOR UPDATE) waits likewise.
  const { row, now, reservation } = await deps.db.transaction(async (tx) => {
    const [exam] = await tx.select().from(exams).where(eq(exams.id, examId)).for('update')
    if (!exam) throw notFound('Exam not found')
    if (!(await isParticipant(tx, examId, userId))) throw forbidden()
    if (!offlineCapable(exam)) throw conflict('Only sittings of written exams can start without network')
    // Read after the lock: a time taken before waiting for it could be stale.
    const now = deps.now()
    if (now < exam.opensAt.getTime() - PRELOAD_BEFORE_MS || now >= exam.opensAt.getTime())
      throw conflict('The package is offered only before the exam opens')
    const [started] = await tx
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.examId, examId), eq(attempts.userId, userId)))
    if (started) throw conflict('The attempt has already started')
    return { row: exam, now, reservation: await reserve(deps, tx, examId, userId) }
  })

  // After the lock is released, since making the code updates the exam row. An edit in between makes
  // sealing refuse with a retry (see sealCurrent), never a package of mixed versions.
  const exam = await withStartCode(deps, row)
  const disabledSignals = await disabledSignalsOf(deps.db, examId, userId)
  return {
    examId,
    attemptId: reservation.attemptId,
    hmacKey: decryptSecret(deps.masterKey, reservation.hmacKeyEnc).toString('base64'),
    title: exam.title,
    durationMin: exam.durationMin,
    opensAt: exam.opensAt.getTime(),
    closesAt: exam.closesAt.getTime(),
    iterations: PACKAGE_ITERATIONS,
    sealed: await sealedFor(deps, exam),
    serverTime: now,
    disabledSignals,
    version: packageVersion(exam, disabledSignals)!,
  }
}

/** For the examiner to read out at the start (not before: the code opens the questions). */
export async function examinerStartCode(deps: Deps, ownerId: string, examId: string) {
  const [exam] = await deps.db
    .select()
    .from(exams)
    .where(and(eq(exams.id, examId), eq(exams.ownerId, ownerId)))
  if (!exam) throw notFound('Exam not found')
  if (!offlineCapable(exam)) throw conflict('This exam cannot start without network')
  if (deps.now() < exam.opensAt.getTime()) throw conflict('The code is shown once the exam opens')
  const withCode = await withStartCode(deps, exam)
  return { code: formatStartCode(decryptSecret(deps.masterKey, withCode.startCodeEnc!).toString()) }
}

/** The exam with its start code, made on first use: one conditional update, no lock on the exam row. */
async function withStartCode({ db, masterKey }: Deps, exam: ExamRow): Promise<ExamRow> {
  if (exam.startCodeEnc) return exam
  const [made] = await db
    .update(exams)
    .set({ startCodeEnc: encryptSecret(masterKey, Buffer.from(newStartCode())) })
    .where(and(eq(exams.id, exam.id), isNull(exams.startCodeEnc)))
    .returning()
  // Someone else made it a moment earlier: use theirs.
  return made ?? (await db.select().from(exams).where(eq(exams.id, exam.id)))[0]!
}

// Sealing stretches the code on purpose (slow), so each exam's package is sealed once per code and reused.
const sealedCache = new Map<string, Promise<SealedPackage>>()
const CACHE_SIZE = 50

function sealedFor(deps: Deps, exam: ExamRow): Promise<SealedPackage> {
  const key = `${exam.id}|${exam.startCodeEnc}`
  let sealed = sealedCache.get(key)
  if (!sealed) {
    sealed = sealCurrent(deps, exam)
    sealed.catch(() => sealedCache.delete(key))
    sealedCache.set(key, sealed)
    if (sealedCache.size > CACHE_SIZE) sealedCache.delete(sealedCache.keys().next().value!)
  }
  return sealed
}

/** Seals the questions as they are under this code: both read in one snapshot, so an edit in between fails. */
async function sealCurrent(deps: Deps, exam: ExamRow): Promise<SealedPackage> {
  const content = await deps.db.transaction(
    async (tx) => {
      const [now] = await tx.select({ code: exams.startCodeEnc }).from(exams).where(eq(exams.id, exam.id))
      if (now?.code !== exam.startCodeEnc) throw conflict('The exam changed just now; try again')
      return studentExam(tx, exam.id, null)
    },
    { isolationLevel: 'repeatable read' },
  )
  const code = decryptSecret(deps.masterKey, exam.startCodeEnc!).toString()
  return sealPackage(JSON.stringify(content), code, exam.id, PACKAGE_ITERATIONS)
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
  return (await reservationOf(tx, examId, userId))!
}

/** The student's reservation, if they downloaded a package: the attempt then takes its id and key. */
export async function reservationOf(db: Db | Tx, examId: string, userId: string) {
  const [row] = await db
    .select()
    .from(examPreloads)
    .where(and(eq(examPreloads.examId, examId), eq(examPreloads.userId, userId)))
  return row ?? null
}
