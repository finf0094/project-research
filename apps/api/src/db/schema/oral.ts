import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { CallEventKind, CallRole } from '@exam/contracts'
import { attempts } from './attempts.ts'

// The live call of an oral exam, as LiveKit reports it through webhooks.

export const callEvents = pgTable(
  'call_events',
  {
    /** LiveKit's event id: a webhook delivered twice is stored once. */
    id: text('id').primaryKey(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id),
    who: text('who').$type<CallRole>().notNull(),
    kind: text('kind').$type<CallEventKind>().notNull(),
    /** LiveKit's time, in whole seconds. */
    at: timestamp('at', { withTimezone: true }).notNull(),
    /** When it arrived (ms): orders a leave and a rejoin within the same second. */
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.attemptId, t.at)],
)
