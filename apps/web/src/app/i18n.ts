import { watch } from 'vue'
import { createI18n } from 'vue-i18n'
import { authMessages } from '@/modules/auth'
import { examMessages } from '@/modules/exam'
import { offlineMessages } from '@/modules/offline'
import { oralMessages } from '@/modules/oral'
import { proctoringMessages } from '@/modules/proctoring'
import { reviewMessages } from '@/modules/review'
import { LOCALES, russianPlural, type Locale } from '@/shared/i18n'
import { commonMessages } from '@/shared/i18n/messages'
import { setFormatLocale } from '@/shared/lib/format'
import { appMessages } from './messages'

const parts = [
  commonMessages,
  appMessages,
  authMessages,
  examMessages,
  offlineMessages,
  oralMessages,
  proctoringMessages,
  reviewMessages,
]
const forLocale = (locale: Locale) => Object.assign({}, ...parts.map((p) => p[locale])) as Schema
type Schema = typeof commonMessages.ru &
  typeof appMessages.ru &
  typeof authMessages.ru &
  typeof examMessages.ru &
  typeof offlineMessages.ru &
  typeof oralMessages.ru &
  typeof proctoringMessages.ru &
  typeof reviewMessages.ru

// Gives key completion in editors; vue-i18n still accepts any string, so i18n.test.ts checks the keys.
declare module 'vue-i18n' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefineLocaleMessage extends Schema {}
}

const STORAGE_KEY = 'locale'

function initialLocale(): Locale {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(STORAGE_KEY)
  } catch {
    /* storage blocked: fall back to the browser language */
  }
  const wanted = saved ?? navigator.language.slice(0, 2)
  return LOCALES.find((l) => l === wanted) ?? 'ru'
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: 'ru',
  messages: { ru: forLocale('ru'), kk: forLocale('kk'), en: forLocale('en') },
  pluralRules: { ru: russianPlural },
})

/** The chosen language survives reloads and drives <html lang> and date formats. */
watch(
  i18n.global.locale,
  (locale) => {
    document.documentElement.lang = locale
    setFormatLocale(locale)
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      /* not remembered, still applied */
    }
  },
  { immediate: true },
)
