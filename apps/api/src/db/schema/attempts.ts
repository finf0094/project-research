import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import type { AnswerValue, AttemptStatus, NetState, ServerAnalysis } from '@exam/contracts'
import { createdAt, epochMs } from './columns.ts'
import { users } from './auth.ts'
import { exams, questions } from './exams.ts'

// A student's attempt: its sealed event log, final answers, uploaded recordings and pending commands.

export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: text('status').$type<AttemptStatus>().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    deadline: timestamp('deadline', { withTimezone: true }).notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    /** Per-attempt HMAC key, AES-256-GCM encrypted with MASTER_KEY. */
    hmacKeyEnc: text('hmac_key_enc').notNull(),
    lastSeq: integer('last_seq').notNull().default(0),
    lastHash: text('last_hash').notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    connection: text('connection').$type<NetState>(),
    /** Set when the event chain failed verification; the attempt then needs manual review. */
    chainBrokenAt: integer('chain_broken_at'),
    /** Oral exams: the question ids of the ticket drawn at start, in order. */
    ticket: uuid('ticket').array(),
    /** When the server next asks for a control fragment; random, so the student cannot prepare for it. */
    nextCaptureAt: timestamp('next_capture_at', { withTimezone: true }),
    riskScore: integer('risk_score'),
    /** Begun without network from a downloaded package (its start time came from the device). */
    startedOffline: boolean('started_offline').notNull().default(false),
    /** A worker took the attempt for analysis at this time (a lease: a crashed worker's claim expires). */
    analysisClaimedAt: timestamp('analysis_claimed_at', { withTimezone: true }),
    /** Whether the server's own models checked the recordings; null until analysis. */
    serverAnalysis: text('server_analysis').$type<ServerAnalysis>(),
    /** Oral exams: the whole answer's audio merged from the recorded chunks (a blob hash), once merged. */
    audioHash: text('audio_hash'),
    /** Set when merging is done (even with nothing to merge), so the worker does not take it again. */
    audioMergedAt: timestamp('audio_merged_at', { withTimezone: true }),
    /** A worker is merging the audio since then (a lease, like the analysis claim). */
    audioClaimedAt: timestamp('audio_claimed_at', { withTimezone: true }),
    /** Failed merge runs so far; a few transient failures are retried, then the merge is given up. */
    audioTries: integer('audio_tries').notNull().default(0),
  },
  (t) => [
    unique().on(t.examId, t.userId),
    index('attempts_waiting_analysis_idx')
      .on(t.submittedAt)
      .where(sql`status = 'submitted'`),
  ],
)

export const events = pgTable(
  'events',
  {
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id),
    seq: integer('seq').notNull(),
    type: text('type').notNull(),
    data: jsonb('data').notNull(),
    clientAt: epochMs('client_at').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    prevHash: text('prev_hash').notNull(),
    hash: text('hash').notNull(),
    mac: text('mac').notNull(),
  },
  (t) => [primaryKey({ columns: [t.attemptId, t.seq] })],
)

export const answers = pgTable(
  'answers',
  {
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    value: jsonb('value').$type<AnswerValue>().notNull(),
    /** Seq of the event this value came from; later events win. */
    seq: integer('seq').notNull(),
  },
  (t) => [primaryKey({ columns: [t.attemptId, t.questionId] })],
)

export const blobs = pgTable(
  'blobs',
  {
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id),
    hash: text('hash').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.attemptId, t.hash] })],
)

export const commands = pgTable(
  'commands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id),
    type: text('type').$type<'warn' | 'capture'>().notNull(),
    payload: jsonb('payload').$type<{ message?: string; seconds?: number }>().notNull(),
    createdAt: createdAt(),
    /** Set when the client acknowledges the command in its chain. */
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  },
  (t) => [
    index('commands_pending_idx')
      .on(t.attemptId)
      .where(sql`delivered_at is null`),
  ],
)
