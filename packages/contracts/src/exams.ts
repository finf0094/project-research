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

export const ExamProfile = z.object({ recording: RecordingMode })
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
