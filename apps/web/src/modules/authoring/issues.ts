import type { z } from 'zod'

type Translate = (key: string, values?: Record<string, unknown>) => string

const SETTINGS: Record<string, string> = {
  title: 'authoring.settings.name',
  opensAt: 'authoring.settings.opensAt',
  closesAt: 'authoring.settings.closesAt',
  durationMin: 'authoring.settings.duration',
  profile: 'authoring.settings.ticketSize',
}
const QUESTION: Record<string, string> = {
  text: 'authoring.questions.text',
  options: 'authoring.questions.options',
  correct: 'authoring.issues.correct',
  points: 'authoring.questions.points',
}

/**
 * Names the fields a failed check points at, in the interface language ("Question 2: answer options"),
 * instead of the contract's internal paths and English messages. Each field is named once.
 */
export function describeIssues(issues: z.core.$ZodIssue[], t: Translate): string[] {
  const names = issues.map(({ path }) => {
    const [first, index, field] = path
    if (first !== 'questions') return t(SETTINGS[String(first)] ?? 'authoring.settings.title')
    if (typeof index !== 'number') return t('authoring.issues.oralOpen')
    const question = t('authoring.questions.number', { n: index + 1 })
    return field === undefined
      ? question
      : `${question}: ${t(QUESTION[String(field)] ?? 'authoring.questions.options')}`
  })
  return [...new Set(names)]
}

/** Which questions (by position) a failed check points at, to mark them in the outline. */
export function questionsWithIssues(issues: z.core.$ZodIssue[]): Set<number> {
  return new Set(
    issues.flatMap(({ path }) => (path[0] === 'questions' && typeof path[1] === 'number' ? [path[1]] : [])),
  )
}
