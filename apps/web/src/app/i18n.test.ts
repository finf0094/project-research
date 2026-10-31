import { AttemptStatus, MarkerKind, NetState, QuestionType, SignalKind, Verdict } from '@exam/contracts'
import { describe, expect, it } from 'vitest'
import { LOCALES } from '@/shared/i18n'
import { i18n } from './i18n'

// Texts looked up by enum value (`review.marker.${kind}`): every value needs a text in every language.
const DYNAMIC: [string, readonly string[]][] = [
  ['review.marker', MarkerKind.options],
  ['review.status', AttemptStatus.options],
  ['review.connection', NetState.options],
  ['review.decision', Verdict.options],
  ['exam.question.type', QuestionType.options],
  // `paste` has no hint: it is logged for the examiner, never shown to the student.
  ['proctoring.hint', SignalKind.options.filter((k) => k !== 'paste')],
  ['oral.state', ['idle', 'connecting', 'connected', 'reconnecting', 'disconnected', 'unavailable']],
]

describe('translations', () => {
  it.each(LOCALES)('has a text for every enum value in %s', (locale) => {
    const missing = DYNAMIC.flatMap(([prefix, values]) =>
      values.map((v) => `${prefix}.${v}`).filter((key) => !i18n.global.te(key, locale)),
    )
    expect(missing).toEqual([])
  })
})
