import type { AnswerValue } from '@exam/contracts'
import Dexie from 'dexie'
import {
  db,
  type LocalAttempt,
  type LocalChunk,
  type PendingPin,
  type RingChunk,
  type StoredPackage,
} from './db'

// The only way other modules touch local data: plain functions over the tables, no Dexie leaking out.

export const getAttempt = (id: string) => db.attempts.get(id)
/** An attempt this user started offline for this exam and has not finished: reopened, not started again. */
export const findOfflineStart = (userId: string, examId: string) =>
  db.attempts
    .filter(
      (a) => a.status === 'active' && a.offlineStart?.examId === examId && a.offlineStart.userId === userId,
    )
    .first()

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

const ringOf = (attemptId: string) =>
  db.ring.where('[attemptId+tStart]').between([attemptId, Dexie.minKey], [attemptId, Dexie.maxKey])

/** Adds a recorded chunk to the ring and drops what is older than `keepMs`; survives reloads. */
export async function putRingChunk(chunk: RingChunk, keepMs: number) {
  await db.transaction('rw', db.ring, async () => {
    await db.ring.put(chunk)
    await db.ring
      .where('[attemptId+tStart]')
      .between([chunk.attemptId, Dexie.minKey], [chunk.attemptId, chunk.tEnd - keepMs])
      .delete()
  })
}

export const listRing = (attemptId: string) => ringOf(attemptId).toArray()

/** Recording is no longer needed once the attempt is finished: what was pinned is already in `chunks`. */
export async function clearRecording(attemptId: string) {
  await db.transaction('rw', db.ring, db.pins, async () => {
    await ringOf(attemptId).delete()
    await db.pins.where('attemptId').equals(attemptId).delete()
  })
}

export const addPin = (pin: PendingPin) => db.pins.add(pin)
export const listPins = (attemptId: string) => db.pins.where('attemptId').equals(attemptId).toArray()
export const deletePin = (id: number) => db.pins.delete(id)

export const savePackage = (pkg: StoredPackage) => db.packages.put(pkg)
export const getPackage = (userId: string, examId: string) => db.packages.get([userId, examId])
export const deletePackage = (userId: string, examId: string) => db.packages.delete([userId, examId])
/** The student's packages on this device. */
export const listPackages = (userId: string) => db.packages.where('userId').equals(userId).toArray()
