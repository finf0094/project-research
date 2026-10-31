import { defineMessages } from '@/shared/i18n'

export const oralMessages = defineMessages({
  ru: {
    oral: {
      ticket: 'Билет',
      waiting: 'Ждём собеседника',
      reconnect: 'Подключиться снова',
      enableSound: 'Включить звук',
      state: {
        idle: 'Видеосвязь не подключена',
        connecting: 'Подключаем видеосвязь…',
        connected: 'Видеосвязь подключена',
        reconnecting: 'Связь прервалась, переподключаемся…',
        disconnected: 'Видеосвязь потеряна',
        unavailable: 'Видеосвязь недоступна. Сообщите преподавателю.',
      },
    },
  },
  kk: {
    oral: {
      ticket: 'Билет',
      waiting: 'Әңгімелесушіні күтудеміз',
      reconnect: 'Қайта қосылу',
      enableSound: 'Дыбысты қосу',
      state: {
        idle: 'Бейнебайланыс қосылмаған',
        connecting: 'Бейнебайланыс қосылуда…',
        connected: 'Бейнебайланыс қосылды',
        reconnecting: 'Байланыс үзілді, қайта қосылудамыз…',
        disconnected: 'Бейнебайланыс жоғалды',
        unavailable: 'Бейнебайланыс қолжетімсіз. Оқытушыға хабарлаңыз.',
      },
    },
  },
  en: {
    oral: {
      ticket: 'Ticket',
      waiting: 'Waiting for the other side',
      reconnect: 'Reconnect',
      enableSound: 'Turn on sound',
      state: {
        idle: 'Video call not connected',
        connecting: 'Connecting the video call…',
        connected: 'Video call connected',
        reconnecting: 'Connection lost, reconnecting…',
        disconnected: 'Video call lost',
        unavailable: 'Video call unavailable. Tell your examiner.',
      },
    },
  },
})
