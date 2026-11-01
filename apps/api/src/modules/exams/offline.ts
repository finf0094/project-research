import { createHash } from 'node:crypto'
import type { exams } from '../../db/schema.ts'

type ExamRow = typeof exams.$inferSelect

/** A sitting: the window is the exam's length plus at most this — reading early then gains nothing. */
const SITTING_SLACK_MS = 60 * 60_000

/**
 * Offline start is for sittings: a written exam whose window barely exceeds its length, so everyone ends by
 * the window's close whenever they began. (A week-long window would let a student decrypt the questions with
 * the code and start much later.)
 */
export const offlineCapable = (exam: Pick<ExamRow, 'profile' | 'opensAt' | 'closesAt' | 'durationMin'>) =>
  exam.profile.mode === 'written' &&
  exam.closesAt.getTime() - exam.opensAt.getTime() <= exam.durationMin * 60_000 + SITTING_SLACK_MS

/** Changes with the start code (an edit resets it), revealing nothing about it. */
export const packageVersion = (exam: Pick<ExamRow, 'startCodeEnc'>) =>
  exam.startCodeEnc ? createHash('sha256').update(exam.startCodeEnc).digest('hex').slice(0, 16) : null
