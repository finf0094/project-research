import { AttemptStatus, MarkerKind, NetState, QuestionType, Role, Verdict } from '@exam/contracts'
import { describe, expect, it } from 'vitest'
import { ROOM_STATES } from '@/modules/oral'
import { HINTED } from '@/modules/proctoring'
import { LOCALES } from '@/shared/i18n'
import { i18n } from './i18n'

// Texts looked up by enum value (`review.marker.${kind}`): every value needs a text in every language.
const DYNAMIC: [string, readonly string[]][] = [
  ['review.marker', MarkerKind.options],
  ['review.status', AttemptStatus.options],
  ['review.connection', NetState.options],
  ['review.decision', Verdict.options],
  ['admin.roles', Role.options],
  ['exam.question.type', QuestionType.options],
  ['proctoring.hint', [...HINTED]],
  ['oral.state', ROOM_STATES],
]

describe('translations', () => {
  it.each(LOCALES)('has a text for every enum value in %s', (locale) => {
    const missing = DYNAMIC.flatMap(([prefix, values]) =>
      values.map((v) => `${prefix}.${v}`).filter((key) => !i18n.global.te(key, locale)),
    )
    expect(missing).toEqual([])
  })
})
