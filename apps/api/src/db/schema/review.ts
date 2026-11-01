import { sql } from 'drizzle-orm'
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import type { MarkerKind, MarkerSource, MarkerStatus, Verdict } from '@exam/contracts'
import { epochMs } from './columns.ts'
import { attempts } from './attempts.ts'
import { users } from './auth.ts'

// What the examiner reviews: timeline markers and the (append-only) decisions.

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
  (t) => [
    index().on(t.attemptId),
    // Calibration (section 25.4) reads only decided markers, on every analysis: this keeps that read small.
    index('markers_decided_index')
      .on(t.attemptId)
      .where(sql`${t.status} in ('confirmed', 'dismissed')`),
  ],
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
    /** Insertion order: the latest decision is the one with the highest seq, even within one millisecond. */
    seq: bigserial('seq', { mode: 'number' }).notNull(),
  },
  (t) => [index().on(t.attemptId, t.decidedAt)],
)

/**
 * What the server's models saw in one recorded chunk (one entry per second), kept once computed: the live
 * analysis during the exam then looks only at chunks that are new.
 */
export const chunkObservations = pgTable(
  'chunk_observations',
  {
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id, { onDelete: 'cascade' }),
    hash: text('hash').notNull(),
    /** Empty when the chunk could not be decoded: it is not tried again. */
    observations: jsonb('observations')
      .$type<{ at: number; faces: number; object: boolean; dark: boolean }[]>()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.attemptId, t.hash] })],
)
