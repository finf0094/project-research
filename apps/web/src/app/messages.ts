import { defineMessages } from '@/shared/i18n'

export const appMessages = defineMessages({
  ru: {
    app: {
      nav: {
        label: 'Разделы',
        exams: 'Экзамены',
        results: 'Результаты',
        calibration: 'Калибровка',
        users: 'Пользователи',
        profile: 'Профиль',
      },
      account: 'Учётная запись: {name}',
      home: 'На главную',
      logout: 'Выйти',
      notFound: 'Такой страницы нет',
      notFoundHint: 'Возможно, ссылка устарела. Начните с главной страницы.',
    },
  },
  kk: {
    app: {
      nav: {
        label: 'Бөлімдер',
        exams: 'Емтихандар',
        results: 'Нәтижелер',
        calibration: 'Калибрлеу',
        users: 'Пайдаланушылар',
        profile: 'Профиль',
      },
      account: 'Есептік жазба: {name}',
      home: 'Басты бетке',
      logout: 'Шығу',
      notFound: 'Мұндай бет жоқ',
      notFoundHint: 'Сілтеме ескірген болуы мүмкін. Басты беттен бастаңыз.',
    },
  },
  en: {
    app: {
      nav: {
        label: 'Sections',
        exams: 'Exams',
        results: 'Results',
        calibration: 'Calibration',
        users: 'Users',
        profile: 'Profile',
      },
      account: 'Account: {name}',
      home: 'Home',
      logout: 'Sign out',
      notFound: 'Page not found',
      notFoundHint: 'The link may be out of date. Start from the home page.',
    },
  },
})
