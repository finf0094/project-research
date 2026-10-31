import type { ExaminerExam } from '@exam/contracts'
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { attempts, examParticipants, exams, questions } from '../../db/schema.ts'
import type { Deps } from '../../deps.ts'
import { conflict } from '../../shared/errors.ts'
import { ownExam } from './access.ts'

/**
 * The examiner's exams with what their cards and the exam page show, newest first. An attempt counts as
 * writing until its deadline plus the offline window: after that nothing it sends can count anyway.
 */
export async function listExams(deps: Deps, ownerId: string, onlyId?: string): Promise<ExaminerExam[]> {
  const { db, config, now } = deps
  const stillWriting = new Date(now() - config.OFFLINE_WINDOW_MIN * 60_000).toISOString()
  const rows = await db
    .select()
    .from(exams)
    .where(and(eq(exams.ownerId, ownerId), onlyId ? eq(exams.id, onlyId) : undefined))
    .orderBy(desc(exams.opensAt))
  if (!rows.length) return []
  const ids = rows.map((e) => e.id)
  const byExam = <T extends { examId: string }>(list: T[]) => new Map(list.map((r) => [r.examId, r]))

  const attemptCounts = byExam(
    await db
      .select({
        examId: attempts.examId,
        total: count(),
        active: count(
          sql`case when ${attempts.status} = 'active' and ${attempts.deadline} > ${stillWriting}::timestamptz then 1 end`,
        ),
        toReview: count(sql`case when ${attempts.status} = 'ready_for_review' then 1 end`),
      })
      .from(attempts)
      .where(inArray(attempts.examId, ids))
      .groupBy(attempts.examId),
  )
  const questionCounts = byExam(
    await db
      .select({
        examId: questions.examId,
        single: count(sql`case when ${questions.type} = 'single' then 1 end`),
        multiple: count(sql`case when ${questions.type} = 'multiple' then 1 end`),
        text: count(sql`case when ${questions.type} = 'text' then 1 end`),
        points: sql<number>`coalesce(sum(${questions.points}), 0)::int`,
      })
      .from(questions)
      .where(inArray(questions.examId, ids))
      .groupBy(questions.examId),
  )
  const participantCounts = byExam(
    await db
      .select({ examId: examParticipants.examId, n: count() })
      .from(examParticipants)
      .where(inArray(examParticipants.examId, ids))
      .groupBy(examParticipants.examId),
  )

  return rows.map((exam) => {
    const a = attemptCounts.get(exam.id)
    const q = questionCounts.get(exam.id)
    return {
      id: exam.id,
      title: exam.title,
      mode: exam.profile.mode,
      opensAt: exam.opensAt.getTime(),
      closesAt: exam.closesAt.getTime(),
      durationMin: exam.durationMin,
      recording: exam.profile.recording,
      questions: {
        single: q?.single ?? 0,
        multiple: q?.multiple ?? 0,
        text: q?.text ?? 0,
        points: q?.points ?? 0,
      },
      participants: participantCounts.get(exam.id)?.n ?? 0,
      publishedAt: exam.publishedAt?.getTime() ?? null,
      attempts: { total: a?.total ?? 0, active: a?.active ?? 0, toReview: a?.toReview ?? 0 },
    }
  })
}

export async function examSummary(deps: Deps, ownerId: string, examId: string): Promise<ExaminerExam> {
  await ownExam(deps.db, ownerId, examId)
  return (await listExams(deps, ownerId, examId))[0]!
}

/**
 * Lets students see their results (scores and the per-question review); attempts not yet decided show
 * later. Only once nobody can still write: the review shows the correct answers.
 */
export async function publishResults({ db, now, config }: Deps, ownerId: string, examId: string) {
  const exam = await ownExam(db, ownerId, examId)
  if (now() < exam.closesAt.getTime() + config.OFFLINE_WINDOW_MIN * 60_000)
    throw conflict('Results can be published once the exam is over')
  // Publishing again keeps the first date: students were told then.
  await db
    .update(exams)
    .set({ publishedAt: sql`coalesce(${exams.publishedAt}, ${new Date(now()).toISOString()}::timestamptz)` })
    .where(eq(exams.id, examId))
}
