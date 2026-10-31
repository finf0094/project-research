/** Interface languages: Russian (default), Kazakh, English. */
export const LOCALES = ['ru', 'kk', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const LOCALE_NAMES: Record<Locale, string> = { ru: 'Русский', kk: 'Қазақша', en: 'English' }

type Messages = { [key: string]: string | Messages }

/**
 * A module's texts in every language. The Russian ones define the keys; the other languages must have
 * exactly the same shape, so a missing translation is a type error, not a blank on screen.
 */
export const defineMessages = <T extends Messages>(messages: { ru: T; kk: NoInfer<T>; en: NoInfer<T> }) =>
  messages

/**
 * Russian plural forms for vue-i18n ("1 минута | 2 минуты | 5 минут"); Kazakh and English need no rule
 * (Kazakh nouns stay singular after a number, English uses "one | many").
 */
export function russianPlural(n: number, forms: number): number {
  if (forms < 3) return n === 1 ? 0 : 1
  const tens = n % 100
  const ones = n % 10
  if (tens >= 11 && tens <= 14) return 2
  if (ones === 1) return 0
  if (ones >= 2 && ones <= 4) return 1
  return 2
}
