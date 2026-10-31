// A finished exam with a class of students, so the examiner's pages (review queue, results, monitoring
// history) have something to show. Attempts are written directly: they stand for exams already taken.
import type { MarkerKind, Verdict } from '@exam/contracts'
import type { Db } from '../src/db/client.ts'
import {
  answers,
  attempts,
  decisions,
  examParticipants,
  exams,
  markers,
  questions,
  users,
} from '../src/db/schema.ts'

const NAMES = [
  'Алия Серикова',
  'Данияр Омаров',
  'Екатерина Ли',
  'Арман Жумабаев',
  'Сабина Касымова',
  'Тимур Нургалиев',
  'Айгуль Бекова',
  'Руслан Ким',
  'Динара Абенова',
  'Ерлан Султанов',
  'Мадина Ахмедова',
  'Игорь Павлов',
]

/** Score in percent, verdict, markers; null score = still waiting for review. */
const OUTCOMES: { score: number | null; verdict: Verdict | null; risk: number; marks: MarkerKind[] }[] = [
  { score: 92, verdict: 'clean', risk: 4, marks: [] },
  { score: 78, verdict: 'clean', risk: 12, marks: ['noise'] },
  { score: 64, verdict: 'clean', risk: 8, marks: [] },
  { score: 55, verdict: 'clean', risk: 20, marks: ['looking_away'] },
  { score: 41, verdict: 'clean', risk: 6, marks: [] },
  { score: 88, verdict: 'violation', risk: 81, marks: ['object_detected', 'object_detected', 'tab_hidden'] },
  { score: 71, verdict: 'clean', risk: 15, marks: ['tab_hidden'] },
  { score: 83, verdict: 'clean', risk: 3, marks: [] },
  { score: null, verdict: null, risk: 74, marks: ['multiple_faces', 'multiple_faces', 'noise'] },
  { score: null, verdict: null, risk: 48, marks: ['face_missing', 'tab_hidden'] },
  { score: null, verdict: null, risk: 22, marks: ['paste'] },
  { score: 67, verdict: 'clean', risk: 9, marks: [] },
]

export async function seedDemoClass(db: Db, teacherId: string, passwordHash: string, now: number) {
  const students = await db
    .insert(users)
    .values(
      NAMES.map((name, i) => ({
        email: `demo${i + 1}@example.edu`,
        name,
        role: 'student' as const,
        passwordHash,
      })),
    )
    .returning()
  const day = 86_400_000
  const [exam] = await db
    .insert(exams)
    .values({
      title: 'Алгоритмы · контрольная',
      durationMin: 60,
      opensAt: new Date(now - 3 * day),
      closesAt: new Date(now - 2 * day),
      profile: { mode: 'written', recording: 'adaptive' },
      ownerId: teacherId,
    })
    .returning()
  const [q1, q2] = await db
    .insert(questions)
    .values([
      {
        examId: exam!.id,
        position: 1,
        type: 'single',
        text: 'Сложность бинарного поиска?',
        options: [
          { id: 'a', text: 'O(log n)' },
          { id: 'b', text: 'O(n)' },
        ],
        correct: ['a'],
        points: 4,
      },
      {
        examId: exam!.id,
        position: 2,
        type: 'text',
        text: 'Объясните быструю сортировку.',
        options: [],
        correct: [],
        points: 6,
      },
    ])
    .returning()
  await db.insert(examParticipants).values(students.map((s) => ({ examId: exam!.id, userId: s.id })))

  const started = now - 3 * day + 3_600_000
  for (const [i, student] of students.entries()) {
    const outcome = OUTCOMES[i]!
    const [attempt] = await db
      .insert(attempts)
      .values({
        examId: exam!.id,
        userId: student.id,
        status: outcome.verdict ? 'decided' : 'ready_for_review',
        startedAt: new Date(started),
        deadline: new Date(started + 3_600_000),
        submittedAt: new Date(started + 3_000_000),
        lastSeenAt: new Date(started + 3_000_000),
        // Never resumed: the key is a placeholder (the attempt's chain is not part of the demo).
        hmacKeyEnc: 'demo',
        lastHash: '0'.repeat(64),
        riskScore: outcome.risk,
        serverAnalysis: 'ok',
      })
      .returning()
    const right = (outcome.score ?? 60) >= 50
    await db.insert(answers).values([
      {
        attemptId: attempt!.id,
        questionId: q1!.id,
        value: right ? 'a' : 'b',
        seq: 1,
      },
      {
        attemptId: attempt!.id,
        questionId: q2!.id,
        value: 'Разделяй и властвуй: опорный элемент…',
        seq: 2,
      },
    ])
    if (outcome.marks.length)
      await db.insert(markers).values(
        outcome.marks.map((kind, k) => ({
          attemptId: attempt!.id,
          kind,
          startAt: started + (k + 1) * 600_000,
          endAt: started + (k + 1) * 600_000 + 40_000,
          status: 'pending' as const,
          chunks: [],
        })),
      )
    if (outcome.verdict)
      await db.insert(decisions).values({
        attemptId: attempt!.id,
        reviewerId: teacherId,
        verdict: outcome.verdict,
        comment: '',
        score: outcome.score,
        decidedAt: new Date(now - day),
      })
  }
}
