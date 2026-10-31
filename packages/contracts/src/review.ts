import { z } from 'zod'
import { Id, Sha256, Timestamp, safeText } from './common.ts'
import { AttemptStatus } from './attempts.ts'
import { AnswerValue, NetState, SignalKind } from './events.ts'
import { ExamMode, Question } from './exams.ts'

export const MarkerKind = z.enum([...SignalKind.options, 'chain_broken', 'missing_fragment', 'offline'])
export type MarkerKind = z.infer<typeof MarkerKind>

/** `context` markers explain the timeline (e.g. offline periods) and are never violations. */
export const MarkerStatus = z.enum(['pending', 'confirmed', 'dismissed', 'context'])
export type MarkerStatus = z.infer<typeof MarkerStatus>

/** Who observed it: the student's device, or the server (its own models, or the chain and upload checks). */
export const MarkerSource = z.enum(['client', 'server'])
export type MarkerSource = z.infer<typeof MarkerSource>

export const Marker = z.object({
  id: Id,
  kind: MarkerKind,
  source: MarkerSource,
  /** The server's models saw this, but the student's device reported nothing at that time. */
  discrepancy: z.boolean(),
  startAt: Timestamp,
  endAt: Timestamp,
  status: MarkerStatus,
  /** Hashes of recorded chunks that cover this marker, if any. */
  chunks: z.array(Sha256),
})
export type Marker = z.infer<typeof Marker>

export const Verdict = z.enum(['clean', 'violation', 'needs_review'])
export type Verdict = z.infer<typeof Verdict>

export const AttemptSummary = z.object({
  id: Id,
  student: z.object({ id: Id, name: z.string() }),
  status: AttemptStatus,
  startedAt: Timestamp,
  lastSeenAt: Timestamp,
  connection: NetState.nullable(),
  answered: z.number().int().nonnegative(),
  markerCount: z.number().int().nonnegative(),
  riskScore: z.number().int().min(0).max(100).nullable(),
})
export type AttemptSummary = z.infer<typeof AttemptSummary>

export const ExaminerExam = z.object({
  id: Id,
  title: z.string(),
  mode: ExamMode,
  opensAt: Timestamp,
  closesAt: Timestamp,
  attempts: z.object({
    active: z.number().int().nonnegative(),
    toReview: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
})
export type ExaminerExam = z.infer<typeof ExaminerExam>

export const ReviewedAnswer = z.object({
  question: Question,
  value: AnswerValue.nullable(),
  /** Points from automatic grading; null for questions graded by the examiner. */
  autoScore: z.number().nullable(),
})
export type ReviewedAnswer = z.infer<typeof ReviewedAnswer>

export const TimelineEvent = z.object({
  seq: z.number().int(),
  type: z.string(),
  at: Timestamp,
  receivedAt: Timestamp,
})
export type TimelineEvent = z.infer<typeof TimelineEvent>

export const AttemptDetail = z.object({
  summary: AttemptSummary,
  examTitle: z.string(),
  examMode: ExamMode,
  submittedAt: Timestamp.nullable(),
  answers: z.array(ReviewedAnswer),
  timeline: z.array(TimelineEvent),
  markers: z.array(Marker),
  decision: z
    .object({ verdict: Verdict, comment: z.string(), score: z.number().int().nullable(), decidedAt: Timestamp })
    .nullable(),
})
export type AttemptDetail = z.infer<typeof AttemptDetail>

export const UpdateMarkerBody = z.object({ status: z.enum(['confirmed', 'dismissed']) })
export type UpdateMarkerBody = z.infer<typeof UpdateMarkerBody>

export const DecisionBody = z.object({
  verdict: Verdict,
  comment: safeText(5000),
  /** Points given by the examiner, e.g. for an oral answer; null when the automatic score stands. */
  score: z.number().int().min(0).max(100).nullable().default(null),
})
export type DecisionBody = z.infer<typeof DecisionBody>

export const ExaminerCommandBody = z.discriminatedUnion('type', [
  z.object({ type: z.literal('warn'), message: safeText(500).min(1) }),
  z.object({ type: z.literal('extend'), minutes: z.number().int().min(1).max(120) }),
  z.object({ type: z.literal('terminate') }),
])
export type ExaminerCommandBody = z.infer<typeof ExaminerCommandBody>
