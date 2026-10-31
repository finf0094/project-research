import { z } from 'zod'
import { Id, Sha256, Timestamp, safeText } from './common.ts'
import { AnswerValue, Event } from './events.ts'
import { StudentExam } from './exams.ts'

/** `submitted` attempts wait for upload of their fragments and then for analysis. */
export const AttemptStatus = z.enum(['active', 'terminated', 'submitted', 'ready_for_review', 'decided'])
export type AttemptStatus = z.infer<typeof AttemptStatus>

export const StartAttemptBody = z.object({ examId: Id })
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
})
export type SyncResponse = z.infer<typeof SyncResponse>

export const SubmitBody = z.object({ lastSeq: z.number().int().nonnegative(), lastHash: Sha256 })
export type SubmitBody = z.infer<typeof SubmitBody>

export const StudentExamListItem = z.object({
  id: Id,
  title: z.string(),
  durationMin: z.number().int().positive(),
  opensAt: Timestamp,
  closesAt: Timestamp,
  questionCount: z.number().int().nonnegative(),
  attempt: z.object({ id: Id, status: AttemptStatus }).nullable(),
})
export type StudentExamListItem = z.infer<typeof StudentExamListItem>
