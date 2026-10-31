import { defineMessages } from './index'

/** Texts used across modules. */
export const commonMessages = defineMessages({
  ru: {
    common: {
      language: 'Язык интерфейса',
      retry: 'Повторить',
      cancel: 'Отмена',
      understood: 'Понятно',
      back: 'Назад',
      teacherMessage: 'Сообщение преподавателя',
      error: {
        offline: 'Нет связи с сервером. Проверьте интернет и повторите.',
        signedOut: 'Сессия входа закончилась. Войдите снова.',
        forbidden: 'Нет доступа.',
        notFound: 'Не найдено. Возможно, ссылка устарела.',
        conflict: 'Сейчас это сделать нельзя: данные изменились. Обновите страницу.',
        unavailable: 'Сервис временно недоступен.',
        generic: 'Что-то пошло не так. Повторите позже.',
      },
    },
  },
  kk: {
    common: {
      language: 'Интерфейс тілі',
      retry: 'Қайталау',
      cancel: 'Бас тарту',
      understood: 'Түсінікті',
      back: 'Артқа',
      teacherMessage: 'Оқытушының хабарламасы',
      error: {
        offline: 'Сервермен байланыс жоқ. Интернетті тексеріп, қайталаңыз.',
        signedOut: 'Кіру сессиясы аяқталды. Қайта кіріңіз.',
        forbidden: 'Рұқсат жоқ.',
        notFound: 'Табылмады. Сілтеме ескірген болуы мүмкін.',
        conflict: 'Мұны қазір жасау мүмкін емес: деректер өзгерді. Бетті жаңартыңыз.',
        unavailable: 'Қызмет уақытша қолжетімсіз.',
        generic: 'Бірдеңе дұрыс болмады. Кейінірек қайталаңыз.',
      },
    },
  },
  en: {
    common: {
      language: 'Interface language',
      retry: 'Try again',
      cancel: 'Cancel',
      understood: 'Got it',
      back: 'Back',
      teacherMessage: 'Message from the examiner',
      error: {
        offline: 'No connection to the server. Check the internet and try again.',
        signedOut: 'Your session has ended. Please sign in again.',
        forbidden: 'Access denied.',
        notFound: 'Not found. The link may be out of date.',
        conflict: 'This cannot be done right now: the data has changed. Refresh the page.',
        unavailable: 'The service is temporarily unavailable.',
        generic: 'Something went wrong. Please try again later.',
      },
    },
  },
})
