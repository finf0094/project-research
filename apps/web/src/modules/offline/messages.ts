import { defineMessages } from '@/shared/i18n'

// Calm wording on purpose: losing the network is not the student's fault and nothing is lost.
export const offlineMessages = defineMessages({
  ru: {
    offline: {
      badge: {
        offline: 'Нет сети — ответы сохраняются на устройстве',
        sending: 'Сохранено на устройстве, отправляем…',
        saved: 'Всё сохранено',
      },
    },
  },
  kk: {
    offline: {
      badge: {
        offline: 'Желі жоқ — жауаптар құрылғыда сақталады',
        sending: 'Құрылғыда сақталды, жіберіп жатырмыз…',
        saved: 'Барлығы сақталды',
      },
    },
  },
  en: {
    offline: {
      badge: {
        offline: 'Offline — answers are saved on this device',
        sending: 'Saved on this device, sending…',
        saved: 'All saved',
      },
    },
  },
})
