import { z } from 'zod'
import { Id, safeText, Timestamp } from './common.ts'
import { ExamProfile, Option, QuestionType } from './exams.ts'
import { Role } from './auth.ts'

/** A question as its author writes it, with the correct options. */
export const QuestionInput = z
  .strictObject({
    type: QuestionType,
    text: safeText(5000).min(1),
    options: z.array(Option.extend({ id: z.string().min(1).max(20), text: safeText(1000).min(1) })).max(12),
    correct: z.array(z.string()),
    points: z.number().int().min(1).max(100),
  })
  .superRefine((q, ctx) => {
    const ids = new Set(q.options.map((o) => o.id))
    if (ids.size !== q.options.length) ctx.addIssue({ code: 'custom', message: 'option ids must be unique' })
    if (q.type === 'text') {
      if (q.options.length || q.correct.length)
        ctx.addIssue({ code: 'custom', message: 'a text question has no options' })
      return
    }
    if (q.options.length < 2) ctx.addIssue({ code: 'custom', message: 'at least two options' })
    if (!q.correct.length || q.correct.some((id) => !ids.has(id)))
      ctx.addIssue({ code: 'custom', message: 'correct answers must be options' })
    if (q.type === 'single' && q.correct.length !== 1)
      ctx.addIssue({ code: 'custom', message: 'a single-choice question has one correct option' })
  })
export type QuestionInput = z.infer<typeof QuestionInput>

/** Everything an exam is made of, as edited on the authoring page and sent whole on save. */
export const ExamDefinition = z
  .strictObject({
    title: safeText(200).min(1),
    durationMin: z.number().int().min(1).max(600),
    opensAt: Timestamp,
    closesAt: Timestamp,
    profile: ExamProfile.strict(),
    questions: z.array(QuestionInput).min(1).max(200),
  })
  .refine((d) => d.closesAt > d.opensAt, {
    message: 'the exam must close after it opens',
    path: ['closesAt'],
  })
  .refine((d) => d.profile.mode === 'written' || (d.profile.ticketSize ?? 0) <= d.questions.length, {
    message: 'a ticket cannot have more questions than the pool',
    path: ['profile', 'ticketSize'],
  })
export type ExamDefinition = z.infer<typeof ExamDefinition>

export const AuthoredExam = z.object({
  id: Id,
  definition: ExamDefinition,
  /** Students have started it: questions and settings are frozen, only participants can change. */
  locked: z.boolean(),
  participants: z.array(z.string()),
})
export type AuthoredExam = z.infer<typeof AuthoredExam>

/** Students allowed to take the exam, by email. */
export const ParticipantsBody = z.strictObject({ emails: z.array(z.email()).max(2000) })
export type ParticipantsBody = z.infer<typeof ParticipantsBody>

export const ParticipantsResult = z.object({
  participants: z.array(z.string()),
  /** Emails with no student account; they were not added. */
  unknown: z.array(z.string()),
})
export type ParticipantsResult = z.infer<typeof ParticipantsResult>

export const UserListItem = z.object({ id: Id, email: z.string(), name: z.string(), role: Role })
export type UserListItem = z.infer<typeof UserListItem>

export const NewUser = z.strictObject({
  email: z.email().max(200),
  name: safeText(200).min(1),
  role: Role,
  password: z.string().min(8).max(200),
})
export type NewUser = z.infer<typeof NewUser>
