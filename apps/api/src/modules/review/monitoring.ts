import type { AttemptSummary, ExaminerExam } from '@exam/contracts'
import { and, asc, count, desc, eq, ne, sql } from 'drizzle-orm'
import type { Db } from '../../db/client.ts'
import { answers, attempts, exams, markers, users } from '../../db/schema.ts'
import type { Deps } from '../../deps.ts'
import { ownExam, toSummary } from './access.ts'

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

async function countPerAttempt(query: Promise<{ id: string; n: number }[]>) {
  return new Map((await query).map((r) => [r.id, r.n]))
}
