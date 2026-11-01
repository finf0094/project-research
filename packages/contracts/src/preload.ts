import { z } from 'zod'
import { Id, Timestamp } from './common.ts'

/**
 * An exam downloaded ahead of time so it can start without network (written exams). The questions are
 * sealed under the exam's start code; the attempt's id and chain key are reserved for this student, so
 * the events written offline are valid once the server sees them.
 */
export const ExamPackage = z.object({
  examId: Id,
  attemptId: Id,
  /** base64 HMAC key of the reserved attempt's event chain. */
  hmacKey: z.string(),
  title: z.string(),
  durationMin: z.number().int().positive(),
  opensAt: Timestamp,
  closesAt: Timestamp,
  iterations: z.number().int().positive(),
  /** The sealed StudentExam (questions and settings), see @exam/integrity's openPackage. */
  sealed: z.object({ iv: z.string(), data: z.string() }),
  serverTime: Timestamp,
  /** Matches StudentExamListItem.offline.version while the package is current. */
  version: z.string(),
})
export type ExamPackage = z.infer<typeof ExamPackage>

/** The start code of an exam, formatted for reading aloud ("7KQ2M-X9FHD"). */
export const StartCode = z.object({ code: z.string() })
export type StartCode = z.infer<typeof StartCode>
