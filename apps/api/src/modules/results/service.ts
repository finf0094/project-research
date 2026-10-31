import type { AnswerValue, QuestionOutcome, StudentResult } from '@exam/contracts'
import { PASS_SCORE } from '@exam/contracts'
import { desc, eq } from 'drizzle-orm'
import type { Db } from '../../db/client.ts'
import { answers, decisions, exams, users } from '../../db/schema.ts'
import { notFound } from '../../shared/errors.ts'
import { ownAttempt } from '../attempts/service.ts'
import { autoScore, finalScore } from '../exams/grading.ts'
import { attemptQuestions } from '../exams/service.ts'

/**
 * The student's own result: available once the examiner decided and published the exam's results.
 * Supervision recordings and markers stay with the examiner; only the verdict is shown.
 */
export async function studentResult(db: Db, userId: string, attemptId: string): Promise<StudentResult> {
  const attempt = await ownAttempt(db, userId, attemptId)
  const [exam] = await db.select().from(exams).where(eq(exams.id, attempt.examId))
  const [decision] = await db
    .select({ decision: decisions, reviewer: users.name })
    .from(decisions)
    .innerJoin(users, eq(users.id, decisions.reviewerId))
    .where(eq(decisions.attemptId, attemptId))
    .orderBy(desc(decisions.seq))
    .limit(1)
  // Not published or not decided yet look the same to the student: "no result yet".
  if (!exam?.publishedAt || !decision || attempt.status !== 'decided') throw notFound('No result yet')

  const asked = await attemptQuestions(db, attempt.examId, attempt.ticket)
  const given = new Map(
    (await db.select().from(answers).where(eq(answers.attemptId, attemptId))).map((a) => [
      a.questionId,
      a.value,
    ]),
  )
  const oral = exam.profile.mode === 'oral'
  const questions = asked.map((q) => outcome(q, given.get(q.id) ?? null, oral))
  const points = {
    auto: questions.reduce((sum, q) => sum + (q.earned ?? 0), 0),
    max: asked.reduce((sum, q) => sum + q.points, 0),
    open: questions.some((q) => q.earned === null),
  }
  const score = finalScore(decision.decision.score, points)
  const violation = decision.decision.verdict === 'violation'
  return {
    examTitle: exam.title,
    decidedAt: decision.decision.decidedAt.getTime(),
    reviewer: decision.reviewer,
    comment: decision.decision.comment,
    score,
    passed: score === null ? null : !violation && score >= PASS_SCORE,
    violation,
    questions,
  }
}

type QuestionRow = Awaited<ReturnType<typeof attemptQuestions>>[number]

function outcome(q: QuestionRow, value: AnswerValue | null, oral: boolean): QuestionOutcome {
  // An oral ticket was answered aloud: the examiner's score covers all of it.
  if (oral)
    return {
      text: q.text,
      type: q.type,
      points: q.points,
      earned: null,
      status: 'examiner',
      answer: null,
      correct: null,
    }
  const texts = (ids: string[]) => ids.map((id) => q.options.find((o) => o.id === id)?.text ?? id).join(', ')
  const answer = value === null ? null : q.type === 'text' ? String(value) : texts([value].flat())
  const earned = autoScore(q, value)
  const status =
    value === null ? 'unanswered' : earned === null ? 'examiner' : earned > 0 ? 'correct' : 'wrong'
  return {
    text: q.text,
    type: q.type,
    points: q.points,
    earned,
    status,
    answer,
    correct: q.type === 'text' ? null : texts(q.correct),
  }
}
