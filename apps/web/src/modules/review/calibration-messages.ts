import { defineMessages } from '@/shared/i18n'

/** Texts of the calibration page (section 25.4). */
export const calibrationMessages = defineMessages({
  ru: {
    calibration: {
      title: 'Калибровка',
      lead: 'Как часто ваши решения совпадали с метками каждого типа. Типы, которые вы чаще отклоняете, весят меньше в приоритете проверки; надёжные — больше. Меняется только порядок очереди, не решения.',
      empty:
        'Пока нет решений по меткам. Подтверждайте и отклоняйте метки при разборе — здесь появится статистика.',
      counts: 'подтверждено {confirmed} · отклонено {dismissed}',
      share: 'Подтверждено {n}%',
      effect: { less: 'вес ×{x} — шумный тип', more: 'вес ×{x} — надёжный тип', same: 'вес без изменений' },
    },
  },
  kk: {
    calibration: {
      title: 'Калибрлеу',
      lead: 'Шешімдеріңіз әр түрдегі белгілермен қаншалықты жиі сәйкес келді. Жиі қабылданбайтын түрлер тексеру басымдығында азырақ салмақ алады; сенімділері — көбірек. Тек кезек реті өзгереді, шешімдер емес.',
      empty:
        'Белгілер бойынша шешім әлі жоқ. Талдау кезінде белгілерді растап не қабылдамаңыз — статистика осында шығады.',
      counts: 'расталды {confirmed} · қабылданбады {dismissed}',
      share: 'Расталды {n}%',
      effect: {
        less: 'салмақ ×{x} — шулы түр',
        more: 'салмақ ×{x} — сенімді түр',
        same: 'салмақ өзгеріссіз',
      },
    },
  },
  en: {
    calibration: {
      title: 'Calibration',
      lead: 'How often your decisions agreed with each kind of marker. Kinds you mostly dismiss weigh less in the review priority; reliable ones weigh more. Only the order of the queue changes, never a decision.',
      empty:
        'No decisions on markers yet. Confirm and dismiss markers while reviewing, and the figures appear here.',
      counts: 'confirmed {confirmed} · dismissed {dismissed}',
      share: '{n}% confirmed',
      effect: {
        less: 'weight ×{x} — a noisy kind',
        more: 'weight ×{x} — a reliable kind',
        same: 'weight unchanged',
      },
    },
  },
})
