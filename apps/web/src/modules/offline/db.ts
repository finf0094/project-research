import type { AnswerValue, AttemptStatus, FragmentReason, StudentExam } from '@exam/contracts'
import type { ChainHead, SealedEvent } from '@exam/integrity'
import Dexie, { type EntityTable, type Table } from 'dexie'

/** How the attempt ended, for the message on the final screen. */
export type EndReason = 'student' | 'time' | 'examiner'

/** Everything needed to continue an attempt with no network, even after a reload. */
export interface LocalAttempt {
  id: string
  exam: StudentExam
  /** Non-extractable HMAC key; IndexedDB stores CryptoKey objects natively. */
  key: CryptoKey
  head: ChainHead
  ackedSeq: number
  deadline: number
  status: AttemptStatus
  /** serverTime - Date.now() at the last sync, used to restore the clock after a reload. */
  clockOffset: number
  /** Set once answers are locked; submission completes as soon as the network allows. */
  endedBy: EndReason | null
}

export interface LocalEvent extends SealedEvent {
  attemptId: string
}

export interface LocalAnswer {
  attemptId: string
  questionId: string
  value: AnswerValue
}

/** A recorded chunk announced in the chain and waiting for upload. */
export interface LocalChunk {
  attemptId: string
  hash: string
  /** Recording start, so chunks upload in the order they were recorded. */
  tStart: number
  blob: Blob
}

/** A piece of the recording ring: the last few minutes, kept on the device and never sent by itself. */
export interface RingChunk {
  attemptId: string
  tStart: number
  tEnd: number
  blob: Blob
}

/** A fragment requested but not yet pinned (it may still need chunks that are being recorded). */
export interface PendingPin {
  id?: number
  attemptId: string
  reason: FragmentReason
  tStart: number
  tEnd: number
}

/** Internal to the offline module: other modules use the functions in local-data.ts. */
export const db = new Dexie('exam') as Dexie & {
  attempts: EntityTable<LocalAttempt, 'id'>
  events: Table<LocalEvent, [string, number]>
  answers: Table<LocalAnswer, [string, string]>
  chunks: Table<LocalChunk, [string, string]>
  ring: Table<RingChunk, [string, number]>
  pins: Table<PendingPin, number>
}

db.version(1).stores({
  attempts: 'id',
  events: '[attemptId+seq]',
  answers: '[attemptId+questionId]',
  chunks: '[attemptId+hash], [attemptId+tStart]',
})
// Version 2: the recording ring and pending fragment requests moved from memory to IndexedDB.
db.version(2).stores({
  ring: '[attemptId+tStart]',
  pins: '++id, attemptId',
})
