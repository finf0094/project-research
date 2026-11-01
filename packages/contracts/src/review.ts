import { z } from 'zod'
import { Id, Sha256, Timestamp, safeText } from './common.ts'
import { AttemptStatus } from './attempts.ts'
import { AnswerValue, NetState, SignalKind } from './events.ts'
import { ExamMode, Question, RecordingMode } from './exams.ts'

export const MarkerKind = z.enum([...SignalKind.options, 'chain_broken', 'missing_fragment', 'offline'])
export type MarkerKind = z.infer<typeof MarkerKind>

/** `context` markers explain the timeline (e.g. offline periods) and are never violations. */
export const MarkerStatus = z.enum(['pending', 'confirmed', 'dismissed', 'context'])
export type MarkerStatus = z.infer<typeof MarkerStatus>

/** Who observed it: the student's device, the server's checks (chain, uploads) or the server's own models. */
export const MarkerSource = z.enum(['client', 'server', 'model'])
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

/** An attempt as every examiner view shows it. */
export const AttemptBase = z.object({
  id: Id,
  student: z.object({ id: Id, name: z.string() }),
  status: AttemptStatus,
  startedAt: Timestamp,
  lastSeenAt: Timestamp,
  connection: NetState.nullable(),
  answered: z.number().int().nonnegative(),
  markerCount: z.number().int().nonnegative(),
  riskScore: z.number().int().min(0).max(100).nullable(),
  /** Begun without network from a downloaded package; its start time comes from the device. */
  startedOffline: z.boolean(),
  /** Some events came through a classroom hub, whose receipt times the server took on trust. */
  relayedByHub: z.boolean(),
})
export type AttemptBase = z.infer<typeof AttemptBase>

/** An attempt in an exam's list: also its points, latest decision and main markers. */
export const AttemptSummary = AttemptBase.extend({
  /** The most frequent marker kinds (not context), for the review queue. */
  topMarkers: z.array(z.object({ kind: MarkerKind, count: z.number().int().positive() })),
  /**
   * Automatic points so far, out of the attempt's questions; `open`: some answers await the examiner.
   * Null for an oral exam: it is answered aloud and only the examiner's score counts.
   */
  points: z
    .object({ auto: z.number().nonnegative(), max: z.number().nonnegative(), open: z.boolean() })
    .nullable(),
  /** The latest decision; `score` in percent (the examiner's, or the automatic one when nothing is open). */
  result: z.object({ verdict: Verdict, score: z.number().int().min(0).max(100).nullable() }).nullable(),
})
export type AttemptSummary = z.infer<typeof AttemptSummary>

export const ExaminerExam = z.object({
  id: Id,
  title: z.string(),
  mode: ExamMode,
  opensAt: Timestamp,
  closesAt: Timestamp,
  durationMin: z.number().int().positive(),
  /** A sitting that students can start without network with the start code. */
  offlineCapable: z.boolean(),
  recording: RecordingMode,
  /** Questions by type, and their total points (for an oral exam: the pool). */
  questions: z.object({
    single: z.number().int().nonnegative(),
    multiple: z.number().int().nonnegative(),
    text: z.number().int().nonnegative(),
    points: z.number().int().nonnegative(),
  }),
  participants: z.number().int().nonnegative(),
  /** When students were allowed to see their results; null while they cannot. */
  publishedAt: Timestamp.nullable(),
  /** From when results may go out: the exam closed and its offline window passed. */
  publishableAt: Timestamp,
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

/**
 * Did the server's own models check the recordings? `partial`: some chunks could not be checked;
 * `unavailable`/`failed`: nothing was checked.
 */
export const ServerAnalysis = z.enum(['ok', 'partial', 'unavailable', 'failed'])
export type ServerAnalysis = z.infer<typeof ServerAnalysis>

/** Who was on an oral exam's call. */
export const CallRole = z.enum(['student', 'examiner'])
export type CallRole = z.infer<typeof CallRole>
export const CallEventKind = z.enum(['joined', 'left'])
export type CallEventKind = z.infer<typeof CallEventKind>
/** A join or leave on the live call, as the call server reported it. */
export const CallEvent = z.object({ who: CallRole, kind: CallEventKind, at: Timestamp })
export type CallEvent = z.infer<typeof CallEvent>

export const AttemptDetail = z.object({
  summary: AttemptBase,
  examId: Id,
  examTitle: z.string(),
  examMode: ExamMode,
  submittedAt: Timestamp.nullable(),
  answers: z.array(ReviewedAnswer),
  timeline: z.array(TimelineEvent),
  markers: z.array(Marker),
  serverAnalysis: ServerAnalysis.nullable(),
  /**
   * How far the server's models got: recording chunks uploaded so far, and how many of them were looked
   * at (during the exam and after it). Shows the examiner that the check is running and where it is.
   */
  serverCheck: z.object({ recorded: z.number().int(), checked: z.number().int() }),
  /** Oral exams: who joined and left the call, in order. */
  call: z.array(CallEvent),
  /**
   * Oral exams: the whole answer's audio merged by the worker. `pending` until the recording is analysed
   * and merged; `empty` when nothing was recorded; `failed` when it could not be merged; `removed` after
   * the retention period.
   */
  audio: z
    .object({ state: z.enum(['pending', 'ready', 'empty', 'failed', 'removed']), hash: Sha256.nullable() })
    .nullable(),
  decision: z
    .object({
      verdict: Verdict,
      comment: z.string(),
      score: z.number().int().nullable(),
      decidedAt: Timestamp,
    })
    .nullable(),
})
export type AttemptDetail = z.infer<typeof AttemptDetail>

/** The examiner's judgement of a marker; `pending` takes a judgement back. */
export const UpdateMarkerBody = z.object({ status: z.enum(['pending', 'confirmed', 'dismissed']) })
export type UpdateMarkerBody = z.infer<typeof UpdateMarkerBody>

export const DecisionBody = z.object({
  verdict: Verdict,
  comment: safeText(5000),
  /** The examiner's grade in percent (0–100), e.g. for an oral answer; null when the automatic score stands. */
  score: z.number().int().min(0).max(100).nullable().default(null),
})
export type DecisionBody = z.infer<typeof DecisionBody>

export const ExaminerCommandBody = z.discriminatedUnion('type', [
  z.object({ type: z.literal('warn'), message: safeText(500).min(1) }),
  z.object({ type: z.literal('extend'), minutes: z.number().int().min(1).max(120) }),
  z.object({ type: z.literal('terminate') }),
])
export type ExaminerCommandBody = z.infer<typeof ExaminerCommandBody>
