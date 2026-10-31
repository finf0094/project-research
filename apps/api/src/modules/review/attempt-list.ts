import type { AttemptSummary, MarkerKind, Verdict } from '@exam/contracts'
import { isEmptyAnswer } from '@exam/contracts'
import { and, asc, count, desc, eq, ne, sql } from 'drizzle-orm'
import { answers, attempts, decisions, markers, questions, users } from '../../db/schema.ts'
import type { Deps } from '../../deps.ts'
import { ownExam, toSummary } from './access.ts'
import { autoScore, finalScore } from '../exams/grading.ts'

/**
 * Attempts of one exam, highest risk first (risk only orders the list; it is not a verdict), with their
 * automatic points and latest decision. Everything is read in a few queries for the whole exam.
 */
export async function listAttempts(deps: Deps, ownerId: string, examId: string): Promise<AttemptSummary[]> {
  const { db } = deps
  const exam = await ownExam(db, ownerId, examId)
  // Oral answers are spoken: choice questions on a ticket are not auto-graded, the examiner scores it all.
  const oral = exam.profile.mode === 'oral'
  const rows = await db
    .select({ attempt: attempts, studentName: users.name })
    .from(attempts)
    .innerJoin(users, eq(users.id, attempts.userId))
    .where(eq(attempts.examId, examId))
    .orderBy(sql`${attempts.riskScore} desc nulls last`, asc(attempts.startedAt))

  const examQuestions = await db.select().from(questions).where(eq(questions.examId, examId))
  const answerRows = await db
    .select({ attemptId: answers.attemptId, questionId: answers.questionId, value: answers.value })
    .from(answers)
    .innerJoin(attempts, eq(attempts.id, answers.attemptId))
    .where(eq(attempts.examId, examId))
  const markerRows = await db
    .select({ attemptId: markers.attemptId, kind: markers.kind, n: count() })
    .from(markers)
    .innerJoin(attempts, eq(attempts.id, markers.attemptId))
    .where(and(eq(attempts.examId, examId), ne(markers.status, 'context')))
    .groupBy(markers.attemptId, markers.kind)
  // The latest decision per attempt (decisions are append-only).
  const decisionRows = await db
    .selectDistinctOn([decisions.attemptId], {
      attemptId: decisions.attemptId,
      verdict: decisions.verdict,
      score: decisions.score,
    })
    .from(decisions)
    .innerJoin(attempts, eq(attempts.id, decisions.attemptId))
    .where(eq(attempts.examId, examId))
    .orderBy(decisions.attemptId, desc(decisions.seq))

  const answersOf = group(answerRows)
  const markersOf = group(markerRows)
  const decisionOf = new Map(decisionRows.map((d) => [d.attemptId, d]))

  return rows.map(({ attempt, studentName }) => {
    const given = new Map(
      (answersOf.get(attempt.id) ?? [])
        .filter((a) => !isEmptyAnswer(a.value))
        .map((a) => [a.questionId, a.value]),
    )
    const asked = attempt.ticket ? examQuestions.filter((q) => attempt.ticket!.includes(q.id)) : examQuestions
    const points = oral ? null : scorePoints(asked, given)
    const kinds = (markersOf.get(attempt.id) ?? []).toSorted((a, b) => b.n - a.n)
    return {
      ...toSummary(
        attempt,
        studentName,
        given.size,
        kinds.reduce((sum, k) => sum + k.n, 0),
        deps.now(),
      ),
      topMarkers: kinds.slice(0, 3).map((k) => ({ kind: k.kind as MarkerKind, count: k.n })),
      points,
      result: resultOf(decisionOf.get(attempt.id), points),
    }
  })
}

function scorePoints(asked: (typeof questions.$inferSelect)[], given: Map<string, unknown>) {
  let auto = 0
  let open = false
  for (const q of asked) {
    const score = autoScore(q, (given.get(q.id) ?? null) as Parameters<typeof autoScore>[1])
    if (score === null) open = true
    else auto += score
  }
  return { auto, max: asked.reduce((sum, q) => sum + q.points, 0), open }
}

function resultOf(
  decision: { verdict: Verdict; score: number | null } | undefined,
  points: { auto: number; max: number; open: boolean } | null,
) {
  if (!decision) return null
  // Sent back for more review: no score stands yet. An oral exam has only the examiner's score.
  if (decision.verdict === 'needs_review') return { verdict: decision.verdict, score: null }
  const score = points ? finalScore(decision.score, points) : decision.score
  return { verdict: decision.verdict, score }
}

function group<T extends { attemptId: string }>(list: T[]) {
  const map = new Map<string, T[]>()
  for (const item of list) map.set(item.attemptId, [...(map.get(item.attemptId) ?? []), item])
  return map
}
