import { sql } from 'drizzle-orm'
import {
  bigint,
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
import type {
  AnswerValue,
  AttemptStatus,
  ExamProfile,
  MarkerKind,
  MarkerSource,
  MarkerStatus,
  NetState,
  QuestionType,
  Role,
  Verdict,
} from '@exam/contracts'

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
/** Event and marker times are epoch milliseconds, exactly as sealed by the client. */
const epochMs = (name: string) => bigint(name, { mode: 'number' })

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').$type<Role>().notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: createdAt(),
})

export const sessions = pgTable('sessions', {
  /** SHA-256 of the session token; the token itself only lives in the cookie. */
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

export const exams = pgTable('exams', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  durationMin: integer('duration_min').notNull(),
  opensAt: timestamp('opens_at', { withTimezone: true }).notNull(),
  closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
  profile: jsonb('profile').$type<ExamProfile>().notNull(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
})

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    type: text('type').$type<QuestionType>().notNull(),
    text: text('text').notNull(),
    options: jsonb('options').$type<{ id: string; text: string }[]>().notNull(),
    /** Correct option ids for automatic grading; empty for questions graded by the examiner. */
    correct: jsonb('correct').$type<string[]>().notNull(),
    points: integer('points').notNull(),
  },
  (t) => [unique().on(t.examId, t.position)],
)

export const examParticipants = pgTable(
  'exam_participants',
  {
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.examId, t.userId] })],
)

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

export const markers = pgTable(
  'markers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id),
    kind: text('kind').$type<MarkerKind>().notNull(),
    startAt: epochMs('start_at').notNull(),
    endAt: epochMs('end_at').notNull(),
    status: text('status').$type<MarkerStatus>().notNull(),
    source: text('source').$type<MarkerSource>().notNull().default('client'),
    discrepancy: boolean('discrepancy').notNull().default(false),
    chunks: text('chunks')
      .array()
      .notNull()
      .default(sql`'{}'`),
  },
  (t) => [index().on(t.attemptId)],
)

/** Append-only audit of verdicts; the latest row is the current decision. */
export const decisions = pgTable(
  'decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id),
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => users.id),
    verdict: text('verdict').$type<Verdict>().notNull(),
    comment: text('comment').notNull(),
    score: integer('score'),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.attemptId, t.decidedAt)],
)
