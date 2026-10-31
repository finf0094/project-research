import { defineMessages } from '@/shared/i18n'

export const appMessages = defineMessages({
  ru: {
    app: {
      nav: { label: 'Разделы', exams: 'Экзамены', users: 'Пользователи' },
      home: 'На главную',
      logout: 'Выйти',
      notFound: 'Такой страницы нет',
      notFoundHint: 'Возможно, ссылка устарела. Начните с главной страницы.',
    },
  },
  kk: {
    app: {
      nav: { label: 'Бөлімдер', exams: 'Емтихандар', users: 'Пайдаланушылар' },
      home: 'Басты бетке',
      logout: 'Шығу',
      notFound: 'Мұндай бет жоқ',
      notFoundHint: 'Сілтеме ескірген болуы мүмкін. Басты беттен бастаңыз.',
    },
  },
  en: {
    app: {
      nav: { label: 'Sections', exams: 'Exams', users: 'Users' },
      home: 'Home',
      logout: 'Sign out',
      notFound: 'Page not found',
      notFoundHint: 'The link may be out of date. Start from the home page.',
    },
  },
})
