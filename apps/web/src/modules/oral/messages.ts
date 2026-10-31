import { defineMessages } from '@/shared/i18n'

export const oralMessages = defineMessages({
  ru: {
    oral: {
      ticket: 'Билет',
      waiting: 'Ждём собеседника',
      reconnect: 'Подключиться снова',
      enableSound: 'Включить звук',
      onAir: 'В эфире',
      recording: 'Ответ записывается',
      stillRecording: 'Ничего не потеряется: ответ записывается на устройстве и отправится сам.',
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
      onAir: 'Эфирде',
      recording: 'Жауап жазылуда',
      stillRecording: 'Ештеңе жоғалмайды: жауап құрылғыда жазылып, өзі жіберіледі.',
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
      onAir: 'On air',
      recording: 'Answer is being recorded',
      stillRecording: 'Nothing is lost: the answer is recorded on this device and sent by itself.',
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
