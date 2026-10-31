import { z } from 'zod'
import { Id, Timestamp } from './common.ts'

export const QuestionType = z.enum(['single', 'multiple', 'text'])
export type QuestionType = z.infer<typeof QuestionType>

export const Option = z.object({ id: z.string(), text: z.string() })
export type Option = z.infer<typeof Option>

/** A question as the student sees it: no correct answers. */
export const Question = z.object({
  id: z.string(),
  type: QuestionType,
  text: z.string(),
  options: z.array(Option),
  points: z.number().int().positive(),
})
export type Question = z.infer<typeof Question>

export const RecordingMode = z.enum(['adaptive', 'full'])
export type RecordingMode = z.infer<typeof RecordingMode>

/** Written: questions answered on screen. Oral: a live conversation with the examiner over a random ticket. */
export const ExamMode = z.enum(['written', 'oral'])
export type ExamMode = z.infer<typeof ExamMode>

export const ExamProfile = z.object({
  mode: ExamMode,
  recording: RecordingMode,
  /** Oral exams: how many questions a ticket draws from the exam's pool. */
  ticketSize: z.number().int().positive().optional(),
})
export type ExamProfile = z.infer<typeof ExamProfile>

export const StudentExam = z.object({
  id: Id,
  title: z.string(),
  durationMin: z.number().int().positive(),
  opensAt: Timestamp,
  closesAt: Timestamp,
  questions: z.array(Question),
  profile: ExamProfile,
})
export type StudentExam = z.infer<typeof StudentExam>
