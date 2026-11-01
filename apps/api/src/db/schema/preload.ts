import { primaryKey, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createdAt } from './columns.ts'
import { users } from './auth.ts'
import { exams } from './exams.ts'

/**
 * A downloaded exam package's reservation: the attempt id and chain key a student gets ahead of time, so an
 * attempt started without network is the same attempt the server creates when it hears of it.
 */
export const examPreloads = pgTable(
  'exam_preloads',
  {
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    attemptId: uuid('attempt_id').notNull().unique(),
    /** The chain's HMAC key, AES-256-GCM encrypted with MASTER_KEY (like an attempt's). */
    hmacKeyEnc: text('hmac_key_enc').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.examId, t.userId] })],
)
