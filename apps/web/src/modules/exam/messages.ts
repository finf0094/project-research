import { defineMessages } from '@/shared/i18n'

export const examMessages = defineMessages({
  ru: {
    exam: {
      list: {
        title: 'Мои экзамены',
        loadFailed: 'Не удалось загрузить список.',
        empty: 'Пока нет назначенных экзаменов.',
        minutes: '{n} минута | {n} минуты | {n} минут',
        questions: 'Вопросов: {n}',
        start: 'Начать →',
        continue: 'Продолжить →',
        state: { open: 'Открыт сейчас', running: 'Идёт', done: 'Сдан', upcoming: 'Скоро', closed: 'Закрыт' },
      },
      unavailable: {
        loadFailed: 'Не удалось открыть экзамен',
        needsInternet: 'Для первого открытия на этом устройстве нужен интернет. Проверьте подключение.',
        oralNeedsInternet: 'Для устного экзамена нужен интернет. Проверьте подключение.',
        elsewhere: 'Экзамен открыт в другой вкладке',
        elsewhereHint: 'Продолжайте там. Закройте эту вкладку, чтобы ответы не перепутались.',
      },
      header: { submit: 'Сдать', step: 'Вопрос {n} из {total}', oral: 'Устный экзамен' },
      page: {
        previous: 'Предыдущий вопрос',
        next: 'Следующий вопрос',
        finish: 'Сдать экзамен',
        examiner: 'Преподаватель',
        oralHint: 'Отвечайте вслух. Когда преподаватель скажет, что ответ принят, нажмите «Сдать».',
      },
      notices: {
        saveFailed:
          'Не удалось сохранить ответ на устройстве. Освободите место на диске и выберите ответ ещё раз.',
        signedOut:
          'Сессия входа закончилась. Ответы сохраняются на устройстве — {link}, чтобы они отправились.',
        signIn: 'войдите снова',
        chainBroken:
          'Сервер не смог подтвердить часть сохранённых данных. Продолжайте экзамен — преподаватель проверит работу вручную.',
      },
      timer: { label: 'Осталось времени', low: 'Осталось меньше 5 минут' },
      finish: {
        title: 'Сдать экзамен?',
        unanswered: 'Без ответа осталось вопросов: {n}. После сдачи изменить ответы будет нельзя.',
        allAnswered: 'Вы ответили на все вопросы. После сдачи изменить ответы будет нельзя.',
        offline: 'Если сейчас нет интернета — ничего страшного: ответы сохранены и отправятся сами.',
        back: 'Вернуться',
        submit: 'Сдать',
      },
      nav: {
        label: 'Вопросы',
        answered: 'Отвечено',
        nextUnanswered: 'К следующему без ответа →',
        question: 'Вопрос {n}',
        questionAnswered: 'Вопрос {n}, есть ответ',
      },
      question: {
        type: { single: 'Один вариант', multiple: 'Несколько вариантов', text: 'Развёрнутый ответ' },
        points: '{n} б.',
        chooseOne: 'Выберите один ответ',
        chooseMany: 'Выберите один или несколько ответов',
        placeholder: 'Ваш ответ',
      },
      done: {
        saved: 'Ответы сохранены',
        byExaminer: 'Преподаватель завершил экзамен',
        byTime: 'Время вышло',
        submitted: 'Экзамен сдан',
        savedHint:
          'Ответы сохранены на устройстве и отправятся, как только появится интернет. Не закрывайте эту страницу.',
        countedHint:
          'Засчитаны все ответы, данные до завершения. Результат появится после проверки преподавателем.',
        signedOut: 'Сессия входа закончилась. {link}, чтобы отправить ответы.',
        signIn: 'Войдите снова',
        uploading:
          'Отправляем запись: осталось фрагментов — {n}. Можно не ждать: загрузка продолжится при следующем входе.',
        allSent: 'Всё отправлено. Страницу можно закрыть.',
        back: 'К моим экзаменам',
      },
      preflight: {
        title: 'Подготовимся к экзамену',
        checks: 'Проверка',
        checking: 'Проверяем…',
        timerHint: 'Время экзамена ещё не идёт: таймер включится только после начала.',
        dataTitle: 'Что происходит с данными',
        answers: 'Ответы',
        answersText:
          'сохраняются на вашем устройстве и отправляются, когда есть интернет. Пропадание сети не считается нарушением.',
        video: 'Видео и звук',
        videoText: 'пишутся только на вашем компьютере, хранятся последние несколько минут.',
        server: 'На сервер',
        serverText:
          'отправляются короткие фрагменты — в спорные моменты и несколько случайных проверок. Не вся запись.',
        decision: 'Решение',
        decisionText: 'принимает только преподаватель. Записи удаляются после проверки.',
        consent: 'Понимаю и согласен(на)',
        start: 'Начать экзамен',
        notOpen: 'Экзамен сейчас не открыт. Проверьте время начала.',
        browser: {
          title: 'Браузер',
          hint: 'Откройте экзамен в свежей версии Chrome, Edge, Firefox или Safari.',
        },
        storage: {
          title: 'Место для ответов на устройстве',
          hint: 'Освободите место на диске: ответы и запись хранятся на устройстве, пока не отправятся.',
        },
        persist: {
          title: 'Надёжное хранение',
          hint: 'Браузер может очистить данные при нехватке места — не закрывайте вкладку до отправки.',
        },
      },
    },
  },
  kk: {
    exam: {
      list: {
        title: 'Менің емтихандарым',
        loadFailed: 'Тізімді жүктеу мүмкін болмады.',
        empty: 'Әзірге тағайындалған емтихан жоқ.',
        minutes: '{n} минут',
        questions: 'Сұрақтар: {n}',
        start: 'Бастау →',
        continue: 'Жалғастыру →',
        state: {
          open: 'Қазір ашық',
          running: 'Жүріп жатыр',
          done: 'Тапсырылды',
          upcoming: 'Жақында',
          closed: 'Жабық',
        },
      },
      unavailable: {
        loadFailed: 'Емтиханды ашу мүмкін болмады',
        needsInternet: 'Бұл құрылғыда алғаш ашу үшін интернет қажет. Байланысты тексеріңіз.',
        oralNeedsInternet: 'Ауызша емтихан үшін интернет қажет. Байланысты тексеріңіз.',
        elsewhere: 'Емтихан басқа қойындыда ашық',
        elsewhereHint: 'Сонда жалғастырыңыз. Жауаптар араласпауы үшін бұл қойындыны жабыңыз.',
      },
      header: { submit: 'Тапсыру', step: 'Сұрақ {n} / {total}', oral: 'Ауызша емтихан' },
      page: {
        previous: 'Алдыңғы сұрақ',
        next: 'Келесі сұрақ',
        finish: 'Емтиханды тапсыру',
        examiner: 'Оқытушы',
        oralHint: 'Дауыстап жауап беріңіз. Оқытушы жауап қабылданды десе, «Тапсыру» батырмасын басыңыз.',
      },
      notices: {
        saveFailed: 'Жауапты құрылғыда сақтау мүмкін болмады. Дискіде орын босатып, жауапты қайта таңдаңыз.',
        signedOut: 'Кіру сессиясы аяқталды. Жауаптар құрылғыда сақталады — олар жіберілуі үшін {link}.',
        signIn: 'қайта кіріңіз',
        chainBroken:
          'Сервер сақталған деректердің бір бөлігін растай алмады. Емтиханды жалғастырыңыз — оқытушы жұмысты қолмен тексереді.',
      },
      timer: { label: 'Қалған уақыт', low: '5 минуттан аз қалды' },
      finish: {
        title: 'Емтиханды тапсырасыз ба?',
        unanswered: 'Жауапсыз қалған сұрақтар: {n}. Тапсырғаннан кейін жауаптарды өзгерту мүмкін емес.',
        allAnswered: 'Барлық сұраққа жауап бердіңіз. Тапсырғаннан кейін жауаптарды өзгерту мүмкін емес.',
        offline: 'Қазір интернет болмаса — қорықпаңыз: жауаптар сақталған және өздері жіберіледі.',
        back: 'Қайту',
        submit: 'Тапсыру',
      },
      nav: {
        label: 'Сұрақтар',
        answered: 'Жауап берілді',
        nextUnanswered: 'Келесі жауапсыз сұраққа →',
        question: '{n}-сұрақ',
        questionAnswered: '{n}-сұрақ, жауап бар',
      },
      question: {
        type: { single: 'Бір нұсқа', multiple: 'Бірнеше нұсқа', text: 'Толық жауап' },
        points: '{n} ұпай',
        chooseOne: 'Бір жауапты таңдаңыз',
        chooseMany: 'Бір немесе бірнеше жауапты таңдаңыз',
        placeholder: 'Сіздің жауабыңыз',
      },
      done: {
        saved: 'Жауаптар сақталды',
        byExaminer: 'Оқытушы емтиханды аяқтады',
        byTime: 'Уақыт бітті',
        submitted: 'Емтихан тапсырылды',
        savedHint: 'Жауаптар құрылғыда сақталды және интернет пайда болғанда жіберіледі. Бұл бетті жаппаңыз.',
        countedHint:
          'Аяқталғанға дейін берілген барлық жауап есептелді. Нәтиже оқытушы тексергеннен кейін шығады.',
        signedOut: 'Кіру сессиясы аяқталды. Жауаптарды жіберу үшін {link}.',
        signIn: 'қайта кіріңіз',
        uploading:
          'Жазба жіберілуде: қалған фрагменттер — {n}. Күтпесеңіз де болады: жүктеу келесі кіргенде жалғасады.',
        allSent: 'Барлығы жіберілді. Бетті жабуға болады.',
        back: 'Менің емтихандарыма',
      },
      preflight: {
        title: 'Емтиханға дайындалайық',
        checks: 'Тексеру',
        checking: 'Тексеріп жатырмыз…',
        timerHint: 'Емтихан уақыты әлі басталған жоқ: таймер тек басталғаннан кейін қосылады.',
        dataTitle: 'Деректермен не болады',
        answers: 'Жауаптар',
        answersText:
          'құрылғыңызда сақталып, интернет болғанда жіберіледі. Желінің үзілуі бұзушылық саналмайды.',
        video: 'Бейне мен дыбыс',
        videoText: 'тек компьютеріңізде жазылады, соңғы бірнеше минуты сақталады.',
        server: 'Серверге',
        serverText:
          'тек қысқа фрагменттер жіберіледі — даулы сәттерде және бірнеше кездейсоқ тексерісте. Бүкіл жазба емес.',
        decision: 'Шешімді',
        decisionText: 'тек оқытушы қабылдайды. Жазбалар тексерістен кейін жойылады.',
        consent: 'Түсінемін және келісемін',
        start: 'Емтиханды бастау',
        notOpen: 'Емтихан қазір ашық емес. Басталу уақытын тексеріңіз.',
        browser: {
          title: 'Браузер',
          hint: 'Емтиханды Chrome, Edge, Firefox немесе Safari-дің жаңа нұсқасында ашыңыз.',
        },
        storage: {
          title: 'Құрылғыдағы жауаптарға арналған орын',
          hint: 'Дискіде орын босатыңыз: жауаптар мен жазба жіберілгенге дейін құрылғыда сақталады.',
        },
        persist: {
          title: 'Сенімді сақтау',
          hint: 'Орын жетпесе, браузер деректерді тазалауы мүмкін — жіберілгенге дейін қойындыны жаппаңыз.',
        },
      },
    },
  },
  en: {
    exam: {
      list: {
        title: 'My exams',
        loadFailed: 'Could not load the list.',
        empty: 'No exams assigned yet.',
        minutes: '{n} minute | {n} minutes',
        questions: 'Questions: {n}',
        start: 'Start →',
        continue: 'Continue →',
        state: {
          open: 'Open now',
          running: 'In progress',
          done: 'Submitted',
          upcoming: 'Coming up',
          closed: 'Closed',
        },
      },
      unavailable: {
        loadFailed: 'Could not open the exam',
        needsInternet: 'Opening it on this device for the first time needs internet. Check your connection.',
        oralNeedsInternet: 'An oral exam needs internet. Check your connection.',
        elsewhere: 'The exam is open in another tab',
        elsewhereHint: 'Continue there. Close this tab so the answers do not get mixed up.',
      },
      header: { submit: 'Submit', step: 'Question {n} of {total}', oral: 'Oral exam' },
      page: {
        previous: 'Previous question',
        next: 'Next question',
        finish: 'Submit the exam',
        examiner: 'Examiner',
        oralHint: 'Answer out loud. When the examiner says your answer is accepted, press “Submit”.',
      },
      notices: {
        saveFailed:
          'Could not save the answer on this device. Free up disk space and choose the answer again.',
        signedOut: 'Your sign-in session has ended. Answers are kept on this device — {link} to send them.',
        signIn: 'sign in again',
        chainBroken:
          'The server could not confirm part of the saved data. Carry on — the examiner will check your work by hand.',
      },
      timer: { label: 'Time left', low: 'Less than 5 minutes left' },
      finish: {
        title: 'Submit the exam?',
        unanswered: 'Questions without an answer: {n}. You cannot change answers after submitting.',
        allAnswered: 'You have answered every question. You cannot change answers after submitting.',
        offline: 'No internet right now? No problem: the answers are saved and will be sent automatically.',
        back: 'Go back',
        submit: 'Submit',
      },
      nav: {
        label: 'Questions',
        answered: 'Answered',
        nextUnanswered: 'Next unanswered →',
        question: 'Question {n}',
        questionAnswered: 'Question {n}, answered',
      },
      question: {
        type: { single: 'One option', multiple: 'Several options', text: 'Written answer' },
        points: '{n} pts',
        chooseOne: 'Choose one answer',
        chooseMany: 'Choose one or more answers',
        placeholder: 'Your answer',
      },
      done: {
        saved: 'Answers saved',
        byExaminer: 'The examiner ended the exam',
        byTime: 'Time is up',
        submitted: 'Exam submitted',
        savedHint:
          'The answers are saved on this device and will be sent as soon as there is internet. Keep this page open.',
        countedHint:
          'Every answer given before the end counts. The result appears after the examiner has reviewed it.',
        signedOut: 'Your sign-in session has ended. {link} to send the answers.',
        signIn: 'Sign in again',
        uploading:
          'Sending the recording: {n} fragments left. No need to wait: the upload continues next time you sign in.',
        allSent: 'Everything is sent. You can close this page.',
        back: 'Back to my exams',
      },
      preflight: {
        title: 'Getting ready for the exam',
        checks: 'Checks',
        checking: 'Checking…',
        timerHint: 'The exam time is not running yet: the timer starts only when you begin.',
        dataTitle: 'What happens to your data',
        answers: 'Answers',
        answersText:
          'are saved on your device and sent when there is internet. Losing the network is not a violation.',
        video: 'Video and sound',
        videoText: 'are recorded only on your computer; only the last few minutes are kept.',
        server: 'The server',
        serverText:
          'receives short fragments only — at disputed moments and a few random checks. Not the whole recording.',
        decision: 'The decision',
        decisionText: 'is made only by the examiner. Recordings are deleted after the review.',
        consent: 'I understand and agree',
        start: 'Start the exam',
        notOpen: 'The exam is not open right now. Check the start time.',
        browser: {
          title: 'Browser',
          hint: 'Open the exam in a recent version of Chrome, Edge, Firefox or Safari.',
        },
        storage: {
          title: 'Space for answers on this device',
          hint: 'Free up disk space: answers and the recording stay on the device until they are sent.',
        },
        persist: {
          title: 'Reliable storage',
          hint: 'The browser may clear data when space runs low — keep the tab open until everything is sent.',
        },
      },
    },
  },
})
