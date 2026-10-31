import type {
  AttemptDetail,
  AttemptSummary,
  DecisionBody,
  ExaminerCommandBody,
  ExaminerExam,
  NetState,
} from '@exam/contracts'
import { and, asc, count, desc, eq, ne, sql } from 'drizzle-orm'
import type { Db, Tx } from '../../db/client.ts'
import {
  answers,
  attempts,
  blobs,
  commands,
  decisions,
  events,
  exams,
  markers,
  users,
} from '../../db/schema.ts'
import type { Deps } from '../../deps.ts'
import { conflict, notFound } from '../../shared/errors.ts'
import { blobKey } from '../../shared/storage.ts'
import { examQuestions, toStudentQuestion } from '../exams/service.ts'
import { autoScore } from './grading.ts'

/** A student that has not synced for this long is shown as offline, whatever its last reported state. */
const SILENCE_MS = 30_000

export async function listExams(db: Db, ownerId: string): Promise<ExaminerExam[]> {
  const rows = await db
    .select({
      exam: exams,
      total: count(attempts.id),
      active: count(sql`case when ${attempts.status} = 'active' then 1 end`),
      toReview: count(sql`case when ${attempts.status} = 'ready_for_review' then 1 end`),
    })
    .from(exams)
    .leftJoin(attempts, eq(attempts.examId, exams.id))
    .where(eq(exams.ownerId, ownerId))
    .groupBy(exams.id)
    .orderBy(desc(exams.opensAt))
  return rows.map(({ exam, total, active, toReview }) => ({
    id: exam.id,
    title: exam.title,
    opensAt: exam.opensAt.getTime(),
    closesAt: exam.closesAt.getTime(),
    attempts: { total, active, toReview },
  }))
}

/** Attempts of one exam, highest risk first. Risk only orders the list; it is not a verdict. */
export async function listAttempts(deps: Deps, ownerId: string, examId: string): Promise<AttemptSummary[]> {
  await ownExam(deps.db, ownerId, examId)
  const rows = await deps.db
    .select({ attempt: attempts, studentName: users.name })
    .from(attempts)
    .innerJoin(users, eq(users.id, attempts.userId))
    .where(eq(attempts.examId, examId))
    .orderBy(sql`${attempts.riskScore} desc nulls last`, asc(attempts.startedAt))
  const answered = await countPerAttempt(
    deps.db
      .select({ id: answers.attemptId, n: count() })
      .from(answers)
      .innerJoin(attempts, eq(attempts.id, answers.attemptId))
      .where(eq(attempts.examId, examId))
      .groupBy(answers.attemptId),
  )
  const flagged = await countPerAttempt(
    deps.db
      .select({ id: markers.attemptId, n: count() })
      .from(markers)
      .innerJoin(attempts, eq(attempts.id, markers.attemptId))
      .where(and(eq(attempts.examId, examId), ne(markers.status, 'context')))
      .groupBy(markers.attemptId),
  )
  return rows.map(({ attempt, studentName }) =>
    toSummary(attempt, studentName, answered.get(attempt.id) ?? 0, flagged.get(attempt.id) ?? 0, deps.now()),
  )
}

export async function attemptDetail(deps: Deps, ownerId: string, attemptId: string): Promise<AttemptDetail> {
  const { db } = deps
  const { attempt, exam } = await ownAttemptOf(db, ownerId, attemptId)
  const [student] = await db.select({ name: users.name }).from(users).where(eq(users.id, attempt.userId))
  const questionRows = await examQuestions(db, exam.id)
  const answerRows = await db.select().from(answers).where(eq(answers.attemptId, attemptId))
  const valueOf = new Map(answerRows.map((a) => [a.questionId, a.value]))
  const timeline = await db
    .select({ seq: events.seq, type: events.type, at: events.clientAt, receivedAt: events.receivedAt })
    .from(events)
    .where(eq(events.attemptId, attemptId))
    .orderBy(asc(events.seq))
  const markerRows = await db
    .select()
    .from(markers)
    .where(eq(markers.attemptId, attemptId))
    .orderBy(asc(markers.startAt))
  const [decision] = await db
    .select()
    .from(decisions)
    .where(eq(decisions.attemptId, attemptId))
    .orderBy(desc(decisions.decidedAt))
    .limit(1)
  const flagged = markerRows.filter((m) => m.status !== 'context').length

  return {
    summary: toSummary(attempt, student?.name ?? '', valueOf.size, flagged, deps.now()),
    examTitle: exam.title,
    submittedAt: attempt.submittedAt?.getTime() ?? null,
    answers: questionRows.map((q) => {
      const value = valueOf.get(q.id) ?? null
      return { question: toStudentQuestion(q), value, autoScore: autoScore(q, value) }
    }),
    timeline: timeline.map((e) => ({ ...e, receivedAt: e.receivedAt.getTime() })),
    markers: markerRows.map((m) => ({
      id: m.id,
      kind: m.kind,
      startAt: m.startAt,
      endAt: m.endAt,
      status: m.status,
      chunks: m.chunks,
    })),
    decision: decision
      ? { verdict: decision.verdict, comment: decision.comment, decidedAt: decision.decidedAt.getTime() }
      : null,
  }
}

export async function sendCommand(deps: Deps, ownerId: string, attemptId: string, body: ExaminerCommandBody) {
  const { db, now } = deps
  await db.transaction(async (tx) => {
    const { attempt } = await ownAttemptOf(tx, ownerId, attemptId, true)
    if (attempt.status !== 'active') throw conflict('Attempt is not running')
    switch (body.type) {
      case 'warn':
        await tx.insert(commands).values({ attemptId, type: 'warn', payload: { message: body.message } })
        break
      case 'extend':
        await tx
          .update(attempts)
          .set({ deadline: new Date(attempt.deadline.getTime() + body.minutes * 60_000) })
          .where(eq(attempts.id, attemptId))
        break
      case 'terminate':
        await tx
          .update(attempts)
          .set({ status: 'terminated', deadline: new Date(now()) })
          .where(eq(attempts.id, attemptId))
        break
    }
  })
}

export async function updateMarker(
  deps: Deps,
  ownerId: string,
  markerId: string,
  status: 'confirmed' | 'dismissed',
) {
  const [marker] = await deps.db.select().from(markers).where(eq(markers.id, markerId))
  if (!marker) throw notFound('Marker not found')
  await ownAttemptOf(deps.db, ownerId, marker.attemptId)
  if (marker.status === 'context') throw conflict('Context markers cannot be judged')
  await deps.db.update(markers).set({ status }).where(eq(markers.id, markerId))
}

/** Every verdict is appended (audit trail); the latest one is the current decision. */
export async function decide(deps: Deps, ownerId: string, attemptId: string, body: DecisionBody) {
  await deps.db.transaction(async (tx) => {
    const { attempt } = await ownAttemptOf(tx, ownerId, attemptId, true)
    if (!['ready_for_review', 'decided'].includes(attempt.status))
      throw conflict('Attempt is not ready for review')
    await tx.insert(decisions).values({
      attemptId,
      reviewerId: ownerId,
      verdict: body.verdict,
      comment: body.comment,
      decidedAt: new Date(deps.now()),
    })
    await tx.update(attempts).set({ status: 'decided' }).where(eq(attempts.id, attemptId))
  })
}

export async function readChunk(deps: Deps, ownerId: string, attemptId: string, hash: string) {
  await ownAttemptOf(deps.db, ownerId, attemptId)
  const [row] = await deps.db
    .select({ mime: blobs.mime })
    .from(blobs)
    .where(and(eq(blobs.attemptId, attemptId), eq(blobs.hash, hash)))
  const data = row ? await deps.storage.get(blobKey(attemptId, hash)) : null
  if (!row || !data) throw notFound('Recording not found')
  return { data, mime: row.mime }
}
async function ownExam(db: Db | Tx, ownerId: string, examId: string) {
  const [exam] = await db
    .select()
    .from(exams)
    .where(and(eq(exams.id, examId), eq(exams.ownerId, ownerId)))
  if (!exam) throw notFound('Exam not found')
  return exam
}

async function ownAttemptOf(db: Db | Tx, ownerId: string, attemptId: string, lock = false) {
  const query = db
    .select({ attempt: attempts, exam: exams })
    .from(attempts)
    .innerJoin(exams, eq(exams.id, attempts.examId))
    .where(and(eq(attempts.id, attemptId), eq(exams.ownerId, ownerId)))
  const [row] = lock ? await query.for('update', { of: attempts }) : await query
  if (!row) throw notFound('Attempt not found')
  return row
}

async function countPerAttempt(query: Promise<{ id: string; n: number }[]>) {
  return new Map((await query).map((r) => [r.id, r.n]))
}

function toSummary(
  attempt: typeof attempts.$inferSelect,
  studentName: string,
  answered: number,
  markerCount: number,
  now: number,
): AttemptSummary {
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
