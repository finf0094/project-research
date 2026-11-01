import type { AttemptDetail, DecisionBody, ExaminerCommandBody, UpdateMarkerBody } from '@exam/contracts'
import { isEmptyAnswer } from '@exam/contracts'
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Tx } from '../../db/client.ts'
import {
  answers,
  attempts,
  blobs,
  chunkObservations,
  commands,
  decisions,
  events,
  exams,
  markers,
  users,
} from '../../db/schema.ts'
import type { Deps } from '../../deps.ts'
import { badRequest, conflict, notFound } from '../../shared/errors.ts'
import { blobKey } from '../../shared/storage.ts'
import { attemptQuestions, toStudentQuestion } from '../exams/service.ts'
import { ownAttemptOf, toSummary } from './access.ts'
import { autoScore } from '../exams/grading.ts'
import { oralRecordingOf } from './recording.ts'
import { fragmentsOf, uploadedOf } from '../../jobs/attempt-data.ts'

export async function attemptDetail(deps: Deps, ownerId: string, attemptId: string): Promise<AttemptDetail> {
  const { db } = deps
  const { attempt, exam } = await ownAttemptOf(db, ownerId, attemptId)
  const [student] = await db.select({ name: users.name }).from(users).where(eq(users.id, attempt.userId))
  const questionRows = await attemptQuestions(db, exam.id, attempt.ticket)
  const answerRows = await db.select().from(answers).where(eq(answers.attemptId, attemptId))
  // A cleared answer is no answer: it counts neither as answered nor as wrong.
  const valueOf = new Map(
    answerRows.filter((a) => !isEmptyAnswer(a.value)).map((a) => [a.questionId, a.value]),
  )
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
    .orderBy(desc(decisions.seq))
    .limit(1)
  // Recording chunks only (an oral exam's merged audio is a blob too, but no chunk of a fragment).
  const uploaded = await uploadedOf(db, attemptId)
  const chunks = new Set((await fragmentsOf(db, attemptId)).flatMap((f) => f.chunks))
  const recorded = [...chunks].filter((hash) => uploaded.has(hash))
  // An empty row is a chunk the models could not decode (kept so the live analysis does not retry it).
  const [checked] = await db
    .select({ n: count() })
    .from(chunkObservations)
    .where(
      and(
        eq(chunkObservations.attemptId, attemptId),
        inArray(chunkObservations.hash, recorded.length ? recorded : ['']),
        sql`jsonb_array_length(${chunkObservations.observations}) > 0`,
      ),
    )
  const flagged = markerRows.filter((m) => m.status !== 'context').length

  return {
    summary: toSummary(attempt, student?.name ?? '', valueOf.size, flagged, deps.now()),
    examId: exam.id,
    examTitle: exam.title,
    examMode: exam.profile.mode,
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
      source: m.source,
      discrepancy: m.discrepancy,
      chunks: m.chunks,
    })),
    serverAnalysis: attempt.serverAnalysis,
    serverCheck: { recorded: recorded.length, checked: checked?.n ?? 0 },
    ...(exam.profile.mode === 'oral'
      ? await oralRecordingOf(db, attempt, deps.now())
      : { call: [], audio: null }),
    decision: decision
      ? {
          verdict: decision.verdict,
          comment: decision.comment,
          score: decision.score,
          decidedAt: decision.decidedAt.getTime(),
        }
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
  status: UpdateMarkerBody['status'],
) {
  const [marker] = await deps.db.select().from(markers).where(eq(markers.id, markerId))
  if (!marker) throw notFound('Marker not found')
  const { attempt } = await ownAttemptOf(deps.db, ownerId, marker.attemptId)
  // Markers are judged while reviewing, as the decision is; before analysis there is nothing settled to judge.
  if (!['ready_for_review', 'decided'].includes(attempt.status))
    throw conflict('Attempt is not ready for review')
  if (marker.status === 'context') throw conflict('Context markers cannot be judged')
  await deps.db.update(markers).set({ status }).where(eq(markers.id, markerId))
}

/**
 * Every verdict is appended (audit trail); the latest one is the current decision. "Needs review" is not
 * a decision for the student: the attempt stays in the queue until it is accepted or a violation confirmed.
 */
export async function decide(deps: Deps, ownerId: string, attemptId: string, body: DecisionBody) {
  await deps.db.transaction(async (tx) => {
    const { attempt, exam } = await ownAttemptOf(tx, ownerId, attemptId, true)
    if (!['ready_for_review', 'decided'].includes(attempt.status))
      throw conflict('Attempt is not ready for review')
    // Accepting work with open answers needs the examiner's score: no automatic total can stand for them.
    if (body.verdict === 'clean' && body.score === null && (await hasOpenAnswers(tx, exam, attempt)))
      throw badRequest('A score is required for open answers')
    await tx.insert(decisions).values({
      attemptId,
      reviewerId: ownerId,
      verdict: body.verdict,
      comment: body.comment,
      score: body.score,
      decidedAt: new Date(deps.now()),
    })
    const status = body.verdict === 'needs_review' ? 'ready_for_review' : 'decided'
    await tx.update(attempts).set({ status }).where(eq(attempts.id, attemptId))
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

/** Oral exams are graded by the examiner as a whole; written ones when a free-text question was asked. */
async function hasOpenAnswers(
  tx: Tx,
  exam: typeof exams.$inferSelect,
  attempt: typeof attempts.$inferSelect,
): Promise<boolean> {
  if (exam.profile.mode === 'oral') return true
  return (await attemptQuestions(tx, attempt.examId, attempt.ticket)).some((q) => q.type === 'text')
}
