import { z } from 'zod'
import { Id, safeText, Timestamp } from './common.ts'
import { ExamProfile, Option, QuestionType } from './exams.ts'
import { Role } from './auth.ts'
import { SignalKind } from './events.ts'

/** Text that must say something: whitespace alone does not count. */
const filled = (max: number) => safeText(max).refine((s) => s.trim().length > 0, 'must not be empty')

/** A question as its author writes it, with the correct options. */
export const QuestionInput = z
  .strictObject({
    type: QuestionType,
    text: filled(5000),
    options: z.array(Option.extend({ id: z.string().min(1).max(20), text: filled(1000) })).max(12),
    correct: z.array(z.string()),
    points: z.number().int().min(1).max(100),
  })
  .superRefine((q, ctx) => {
    const ids = new Set(q.options.map((o) => o.id))
    if (ids.size !== q.options.length)
      ctx.addIssue({ code: 'custom', message: 'option ids must be unique', path: ['options'] })
    if (q.type === 'text') {
      if (q.options.length || q.correct.length)
        ctx.addIssue({ code: 'custom', message: 'a text question has no options', path: ['options'] })
      return
    }
    if (q.options.length < 2)
      ctx.addIssue({ code: 'custom', message: 'at least two options', path: ['options'] })
    if (new Set(q.correct).size !== q.correct.length)
      ctx.addIssue({ code: 'custom', message: 'correct answers must not repeat', path: ['correct'] })
    if (!q.correct.length || q.correct.some((id) => !ids.has(id)))
      ctx.addIssue({ code: 'custom', message: 'correct answers must be options', path: ['correct'] })
    if (q.type === 'single' && q.correct.length !== 1)
      ctx.addIssue({
        code: 'custom',
        message: 'a single-choice question has one correct option',
        path: ['correct'],
      })
  })
export type QuestionInput = z.infer<typeof QuestionInput>

/** Everything an exam is made of, as edited on the authoring page and sent whole on save. */
export const ExamDefinition = z
  .strictObject({
    title: filled(200),
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
  .refine(
    (d) =>
      d.profile.mode === 'written' ||
      (d.profile.ticketSize !== undefined && d.profile.ticketSize <= d.questions.length),
    { message: 'an oral exam needs a ticket size no larger than the pool', path: ['profile', 'ticketSize'] },
  )
  // An oral answer is spoken and graded by the examiner: the ticket shows question texts only.
  .refine((d) => d.profile.mode === 'written' || d.questions.every((q) => q.type === 'text'), {
    message: 'oral exam questions are open questions',
    path: ['questions'],
  })
export type ExamDefinition = z.infer<typeof ExamDefinition>

export const AuthoredExam = z.object({
  id: Id,
  definition: ExamDefinition,
  /** Students have started it: questions and settings are frozen, only participants can change. */
  locked: z.boolean(),
  participants: z.array(z.string()),
  exceptions: z.array(z.lazy(() => SignalException)),
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

/**
 * Section 25.3: an individual exception — signals not watched for one student (special needs, e.g. a student
 * who reads aloud or cannot keep their head still). The device does not raise them, the server sets no
 * markers for them.
 */
export const SignalException = z.strictObject({
  email: z.email(),
  disabledSignals: z.array(SignalKind).max(12),
})
export type SignalException = z.infer<typeof SignalException>

export const UserListItem = z.object({ id: Id, email: z.string(), name: z.string(), role: Role })
export type UserListItem = z.infer<typeof UserListItem>

export const NewUser = z.strictObject({
  email: z.email().max(200),
  name: filled(200),
  role: Role,
  password: z.string().min(8).max(200),
})
export type NewUser = z.infer<typeof NewUser>
