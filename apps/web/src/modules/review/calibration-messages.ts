import { defineMessages } from '@/shared/i18n'

/** Texts of the calibration page (section 25.4). */
export const calibrationMessages = defineMessages({
  ru: {
    calibration: {
      title: 'Калибровка',
      lead: 'Как часто ваши решения совпадали с метками каждого типа. Типы, которые вы чаще отклоняете, весят меньше в приоритете проверки — для них порог фактически повышается. Сами решения принимаете только вы.',
      loading: 'Загружаем…',
      empty:
        'Пока нет решений по меткам. Подтверждайте и отклоняйте метки при разборе — здесь появится статистика.',
      counts: 'подтверждено {confirmed} · отклонено {dismissed}',
      share: '{n}% подтверждено',
      effect: { less: 'вес ×{x} — шумный тип', same: 'вес без изменений', few: 'мало решений, вес прежний' },
      control: {
        title: 'Контрольная выборка',
        text: 'Попытки без меток, которые вы проверили: сколько из них всё же оказались нарушением. Это оценка того, что метки пропускают.',
        none: 'Пока нет проверенных попыток без меток.',
        result: 'Проверено без меток: {n}, нарушений найдено: {m} ({p}%)',
      },
    },
  },
  kk: {
    calibration: {
      title: 'Калибрлеу',
      lead: 'Шешімдеріңіз әр түрдегі белгілермен қаншалықты жиі сәйкес келді. Жиі қабылданбайтын түрлер тексеру басымдығында азырақ салмақ алады — олар үшін шек іс жүзінде жоғарылайды. Шешімді тек сіз қабылдайсыз.',
      loading: 'Жүктелуде…',
      empty:
        'Белгілер бойынша шешім әлі жоқ. Талдау кезінде белгілерді растап не қабылдамаңыз — статистика осында шығады.',
      counts: 'расталды {confirmed} · қабылданбады {dismissed}',
      share: '{n}% расталды',
      effect: {
        less: 'салмақ ×{x} — шулы түр',
        same: 'салмақ өзгеріссіз',
        few: 'шешімдер аз, салмақ бұрынғы',
      },
      control: {
        title: 'Бақылау іріктемесі',
        text: 'Сіз тексерген белгісіз талпыныстар: олардың қаншасы бәрібір бұзушылық болып шықты. Бұл белгілер өткізіп алатын нәрсенің бағасы.',
        none: 'Белгісіз тексерілген талпыныстар әлі жоқ.',
        result: 'Белгісіз тексерілді: {n}, бұзушылық табылды: {m} ({p}%)',
      },
    },
  },
  en: {
    calibration: {
      title: 'Calibration',
      lead: 'How often your decisions agreed with each kind of marker. Kinds you mostly dismiss weigh less in the review priority — their threshold is effectively raised. Only you make decisions.',
      loading: 'Loading…',
      empty:
        'No decisions on markers yet. Confirm and dismiss markers while reviewing, and the figures appear here.',
      counts: 'confirmed {confirmed} · dismissed {dismissed}',
      share: '{n}% confirmed',
      effect: {
        less: 'weight ×{x} — a noisy kind',
        same: 'weight unchanged',
        few: 'few decisions, weight unchanged',
      },
      control: {
        title: 'Control sample',
        text: 'Attempts without markers that you reviewed: how many still turned out to be a violation. An estimate of what the markers miss.',
        none: 'No reviewed attempts without markers yet.',
        result: 'Reviewed without markers: {n}, violations found: {m} ({p}%)',
      },
    },
  },
})
