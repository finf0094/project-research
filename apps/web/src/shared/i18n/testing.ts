import { createI18n } from 'vue-i18n'
import { commonMessages } from './messages'

type Parts = { ru: object }[]

/** An i18n plugin for component tests: the given module texts (Russian) plus the common ones. */
export function testI18n(...parts: Parts) {
  const ru = Object.assign({}, commonMessages.ru, ...parts.map((p) => p.ru))
  return createI18n({ legacy: false, locale: 'ru', messages: { ru } })
}
