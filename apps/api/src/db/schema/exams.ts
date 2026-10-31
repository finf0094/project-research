import { integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import type { ExamProfile, QuestionType } from '@exam/contracts'
import { createdAt } from './columns.ts'
import { users } from './auth.ts'

// Exams, their questions and who may take them.

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
