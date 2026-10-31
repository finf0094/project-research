import type { AnswerValue } from '@exam/contracts'
import Dexie from 'dexie'
import { db, type LocalAttempt, type LocalChunk } from './db'

// The only way other modules touch local data: plain functions over the tables, no Dexie leaking out.

export const getAttempt = (id: string) => db.attempts.get(id)

export async function saveAttempt(attempt: LocalAttempt, answers: Record<string, AnswerValue>) {
  await db.transaction('rw', db.attempts, db.answers, async () => {
    await db.attempts.put(attempt)
    await db.answers.bulkPut(
      Object.entries(answers).map(([questionId, value]) => ({ attemptId: attempt.id, questionId, value })),
    )
  })
}

export const updateAttempt = (id: string, patch: Partial<Omit<LocalAttempt, 'id'>>) =>
  db.attempts.update(id, patch)

export async function listAnswers(attemptId: string): Promise<Record<string, AnswerValue>> {
  const rows = await db.answers
    .where('[attemptId+questionId]')
    .between([attemptId, Dexie.minKey], [attemptId, Dexie.maxKey])
    .toArray()
  return Object.fromEntries(rows.map((r) => [r.questionId, r.value]))
}

/** Use inside an event-log `onWrite`, so the answer and its event are stored together. */
export const putAnswer = (attemptId: string, questionId: string, value: AnswerValue) =>
  db.answers.put({ attemptId, questionId, value })

/** Use inside an event-log `onWrite`, so the chunks and the event announcing them are stored together. */
export const putChunks = (chunks: LocalChunk[]) => db.chunks.bulkPut(chunks)

export const countChunks = (attemptId: string) =>
  db.chunks.where('[attemptId+tStart]').between([attemptId, Dexie.minKey], [attemptId, Dexie.maxKey]).count()

export const listEvents = (attemptId: string) =>
  db.events.where('[attemptId+seq]').between([attemptId, Dexie.minKey], [attemptId, Dexie.maxKey]).toArray()
