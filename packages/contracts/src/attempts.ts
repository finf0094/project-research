import { z } from 'zod'
import { Id, Sha256, Timestamp, safeText } from './common.ts'
import { AnswerValue, Event, SignalKind } from './events.ts'
import { ExamMode, QuestionType, StudentExam } from './exams.ts'

/** `submitted` attempts wait for upload of their fragments and then for analysis. */
export const AttemptStatus = z.enum(['active', 'terminated', 'submitted', 'ready_for_review', 'decided'])
export type AttemptStatus = z.infer<typeof AttemptStatus>

export const StartAttemptBody = z.object({
  examId: Id,
  /** Set when the attempt was started without network from a downloaded package (client time). */
  offlineStartedAt: Timestamp.optional(),
})
export type StartAttemptBody = z.infer<typeof StartAttemptBody>

/** Everything the client needs to run (or resume) an attempt offline. */
export const AttemptSession = z.object({
  attemptId: Id,
  exam: StudentExam,
  status: AttemptStatus,
  deadline: Timestamp,
  serverTime: Timestamp,
  /** Base64-encoded raw HMAC key for sealing events. */
  hmacKey: z.base64(),
  ackedSeq: z.number().int().nonnegative(),
  lastHash: Sha256,
  /** Answers the server already holds, by question id: lets a student continue on another device. */
  answers: z.record(z.string(), AnswerValue),
  /** Signals not watched for this student (an individual exception, section 25.3). */
  disabledSignals: z.array(SignalKind),
})
export type AttemptSession = z.infer<typeof AttemptSession>

export const Command = z.discriminatedUnion('type', [
  z.object({ id: Id, type: z.literal('warn'), message: safeText(500) }),
  z.object({ id: Id, type: z.literal('capture'), seconds: z.number().int().min(5).max(60) }),
])
export type Command = z.infer<typeof Command>

export const SyncBody = z.object({ events: z.array(Event).max(100) })
export type SyncBody = z.infer<typeof SyncBody>

/** Response to /sync. Deadline and status come from the server, so extensions and termination need no extra channel. */
export const SyncResponse = z.object({
  ackedSeq: z.number().int().nonnegative(),
  status: AttemptStatus,
  deadline: Timestamp,
  serverTime: Timestamp,
  /** The chain failed verification: the server accepts no more events, but the attempt can still be submitted. */
  chainBroken: z.boolean(),
  commands: z.array(Command),
  /**
   * Set by a classroom hub answering while the cloud is away: it holds the events up to here. They are not in
   * the cloud yet (`ackedSeq` stays the cloud's), so the device keeps them, but needs not send them again.
   */
  relayedSeq: z.number().int().nonnegative().optional(),
})
export type SyncResponse = z.infer<typeof SyncResponse>

export const SubmitBody = z.object({ lastSeq: z.number().int().nonnegative(), lastHash: Sha256 })
export type SubmitBody = z.infer<typeof SubmitBody>

export const StudentExamListItem = z.object({
  id: Id,
  title: z.string(),
  mode: ExamMode,
  durationMin: z.number().int().positive(),
  opensAt: Timestamp,
  closesAt: Timestamp,
  questionCount: z.number().int().nonnegative(),
  /** `resultReady`: the examiner decided and published, so the student can open their result. */
  attempt: z.object({ id: Id, status: AttemptStatus, resultReady: z.boolean() }).nullable(),
  /**
   * Set for sittings that can start without network: the package's version (it changes when the exam is
   * edited), null until the first package was made. A device with an older package downloads it again.
   */
  offline: z.object({ version: z.string().nullable() }).nullable(),
})
export type StudentExamListItem = z.infer<typeof StudentExamListItem>

/** Pass mark in percent; a confirmed violation fails whatever the score. */
export const PASS_SCORE = 50

/** How one question went, as the student sees it after publication. */
export const QuestionOutcome = z.object({
  text: z.string(),
  type: QuestionType,
  points: z.number().int(),
  /** Points earned; null for open answers, which the examiner graded as part of the whole. */
  earned: z.number().nullable(),
  status: z.enum(['correct', 'wrong', 'unanswered', 'examiner']),
  /** The student's answer and, for choice questions, the right one (as option texts). */
  answer: z.string().nullable(),
  correct: z.string().nullable(),
})
export type QuestionOutcome = z.infer<typeof QuestionOutcome>

export const StudentResult = z.object({
  examTitle: z.string(),
  decidedAt: Timestamp,
  reviewer: z.string(),
  comment: z.string(),
  /** Percent; null if the examiner gave no score and open answers prevent an automatic one. */
  score: z.number().int().min(0).max(100).nullable(),
  passed: z.boolean().nullable(),
  /** A violation was confirmed; the recording itself is never shown to the student. */
  violation: z.boolean(),
  questions: z.array(QuestionOutcome),
})
export type StudentResult = z.infer<typeof StudentResult>

/** Credentials to join the oral exam's live room (LiveKit). */
export const OralRoomAccess = z.object({ url: z.string(), token: z.string(), room: z.string() })
export type OralRoomAccess = z.infer<typeof OralRoomAccess>
