import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import type { AttemptSession, AttemptStatus, SubmitBody } from '@exam/contracts'
import { genesisHash } from '@exam/integrity'
import { and, eq } from 'drizzle-orm'
import type { Db, Tx } from '../../db/client.ts'
import { answers, attempts, exams } from '../../db/schema.ts'
import type { Deps } from '../../deps.ts'
import { decryptSecret, encryptSecret } from '../../shared/crypto.ts'
import { conflict, forbidden, notFound } from '../../shared/errors.ts'
import { examQuestions, isParticipant, studentExam } from '../exams/service.ts'
import { offlineCapable } from '../exams/offline.ts'
import { reservationOf } from '../preload/service.ts'

type AttemptRow = typeof attempts.$inferSelect

/** Statuses in which the client may still append events. Termination closes answers via the deadline, not the chain. */
export const OPEN_STATUSES: readonly AttemptStatus[] = ['active', 'terminated']

/** Control fragments are requested at random moments between these bounds. */
const CAPTURE_MIN_MS = 4 * 60_000
const CAPTURE_MAX_MS = 12 * 60_000
export const nextCaptureTime = (now: number, random = Math.random) =>
  new Date(now + CAPTURE_MIN_MS + random() * (CAPTURE_MAX_MS - CAPTURE_MIN_MS))

/**
 * Starts the student's attempt, or returns the running one so a student who lost local data can resume.
 * `offlineStartedAt`: begun without network from a downloaded package at that device time (see offlineStart).
 */
export async function startAttempt(
  deps: Deps,
  userId: string,
  examId: string,
  offlineStartedAt?: number,
): Promise<AttemptSession> {
  const now = deps.now()
  return deps.db.transaction(async (tx) => {
    // Locks the exam against a concurrent edit (authoring takes FOR UPDATE): the attempt is built from the
    // questions and settings as they are once that edit is done, and participants cannot change meanwhile.
    const [exam] = await tx.select().from(exams).where(eq(exams.id, examId)).for('share')
    if (!(await isParticipant(tx, examId, userId))) throw forbidden()

    const existing = await findAttempt(tx, examId, userId)
    if (existing) return resume(deps, tx, existing)

    if (!exam) throw notFound('Exam not found')
    // A downloaded package reserved the attempt's id and key: the events written offline are sealed with them.
    const reserved = await reservationOf(tx, examId, userId)
    // An offline start is heard of only after the sitting opened (its code is read out then), and only for
    // sittings: anything else would hand out the questions early.
    if (
      offlineStartedAt !== undefined &&
      (!reserved || !offlineCapable(exam) || now < exam.opensAt.getTime())
    )
      throw conflict('Not a valid offline start')
    const startedAt = offlineStartedAt === undefined ? now : offlineStart(exam, offlineStartedAt, now)
    if (offlineStartedAt === undefined && (now < exam.opensAt.getTime() || now >= exam.closesAt.getTime()))
      throw conflict('Exam is not open')

    const id = reserved?.attemptId ?? randomUUID()
    // An oral exam draws a random ticket from the question pool; written exams use every question.
    const ticket =
      exam.profile.mode === 'oral'
        ? shuffle((await examQuestions(tx, examId)).map((q) => q.id)).slice(0, exam.profile.ticketSize ?? 3)
        : null
    if (ticket?.length === 0) throw conflict('The exam has no questions to draw a ticket from')
    const [row] = await tx
      .insert(attempts)
      .values({
        id,
        examId,
        userId,
        status: 'active',
        startedAt: new Date(startedAt),
        startedOffline: offlineStartedAt !== undefined,
        deadline: new Date(Math.min(startedAt + exam.durationMin * 60_000, exam.closesAt.getTime())),
        hmacKeyEnc: reserved?.hmacKeyEnc ?? encryptSecret(deps.masterKey, randomBytes(32)),
        lastHash: await genesisHash(id),
        lastSeenAt: new Date(now),
        ticket,
        nextCaptureAt: exam.profile.recording === 'adaptive' ? nextCaptureTime(now) : null,
      })
      .onConflictDoNothing()
      .returning()
    // A parallel request (double click, two tabs) created it first: resume that one.
    if (!row) return resume(deps, tx, (await findAttempt(tx, examId, userId))!)
    return toSession(deps, tx, row)
  })
}

/**
 * The start time of an attempt begun offline. Never refused (the device has already sealed the student's
 * answers): a device time outside what is possible is pulled into the window — not before opening, not in the
 * future, not after closing. Offline start exists only for sittings, so the deadline (at most the window's
 * close) leaves nothing to gain; answers still count only if they arrive within the offline window.
 */
function offlineStart(exam: { opensAt: Date; closesAt: Date }, claimed: number, now: number): number {
  const latest = Math.min(now, exam.closesAt.getTime() - 1)
  return Math.max(exam.opensAt.getTime(), Math.min(claimed, latest))
}

async function findAttempt(tx: Tx, examId: string, userId: string) {
  const [row] = await tx
    .select()
    .from(attempts)
    .where(and(eq(attempts.examId, examId), eq(attempts.userId, userId)))
    .for('update')
  return row
}

function resume(deps: Deps, tx: Tx, attempt: AttemptRow) {
  if (!OPEN_STATUSES.includes(attempt.status)) throw conflict('Attempt already finished')
  return toSession(deps, tx, attempt)
}

export async function getSession(deps: Deps, userId: string, attemptId: string): Promise<AttemptSession> {
  return deps.db.transaction(async (tx) => toSession(deps, tx, await ownAttempt(tx, userId, attemptId)))
}

/**
 * Finishes the attempt once the server holds every event the client has.
 * After a chain break the server accepts no events, so the attempt is submitted as is and reviewed by a person.
 */
export async function submitAttempt(deps: Deps, userId: string, attemptId: string, body: SubmitBody) {
  return deps.db.transaction(async (tx) => {
    const attempt = await ownAttempt(tx, userId, attemptId, true)
    if (attempt.status === 'submitted') return { status: attempt.status }
    if (!OPEN_STATUSES.includes(attempt.status)) throw conflict('Attempt already finished')
    const synced = body.lastSeq === attempt.lastSeq && body.lastHash === attempt.lastHash
    if (!synced && attempt.chainBrokenAt === null) {
      throw conflict('Not all events are synced yet')
    }
    await tx
      .update(attempts)
      .set({ status: 'submitted', submittedAt: new Date(deps.now()) })
      .where(eq(attempts.id, attemptId))
    return { status: 'submitted' as const }
  })
}

export async function ownAttempt(
  tx: Db | Tx,
  userId: string,
  attemptId: string,
  lock = false,
): Promise<AttemptRow> {
  const query = tx.select().from(attempts).where(eq(attempts.id, attemptId))
  const [row] = lock ? await query.for('update') : await query
  if (!row || row.userId !== userId) throw notFound('Attempt not found')
  return row
}

export function attemptKey(deps: Pick<Deps, 'masterKey'>, attempt: Pick<AttemptRow, 'hmacKeyEnc'>): Buffer {
  return decryptSecret(deps.masterKey, attempt.hmacKeyEnc)
}

async function toSession(deps: Deps, tx: Tx, attempt: AttemptRow): Promise<AttemptSession> {
  const exam = await studentExam(tx, attempt.examId, attempt.ticket)
  if (!exam) throw notFound('Exam not found')
  const saved = await tx.select().from(answers).where(eq(answers.attemptId, attempt.id))
  return {
    attemptId: attempt.id,
    exam,
    status: attempt.status,
    deadline: attempt.deadline.getTime(),
    serverTime: deps.now(),
    hmacKey: attemptKey(deps, attempt).toString('base64'),
    ackedSeq: attempt.lastSeq,
    lastHash: attempt.lastHash,
    answers: Object.fromEntries(saved.map((a) => [a.questionId, a.value])),
  }
}

/** Fisher–Yates with a cryptographic source: a ticket must not be predictable. */
function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}
