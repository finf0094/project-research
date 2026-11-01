import { defineMessages } from '@/shared/i18n'

export const authMessages = defineMessages({
  ru: {
    auth: {
      title: 'С возвращением',
      subtitle: 'Войдите через учётную запись университета.',
      password: 'Пароль',
      submit: 'Войти',
      badCredentials: 'Неверный email или пароль',
      tooMany: 'Слишком много попыток входа. Подождите минуту и попробуйте снова.',
      showPassword: 'Показать пароль',
      help: 'Нужна помощь со входом?',
      helpText:
        'Учётные записи выдаёт администратор вашего факультета: он же поможет, если вы забыли пароль или не видите свой экзамен.',
    },
  },
  kk: {
    auth: {
      title: 'Қош келдіңіз',
      subtitle: 'Университеттің есептік жазбасымен кіріңіз.',
      password: 'Құпиясөз',
      submit: 'Кіру',
      badCredentials: 'Email немесе құпиясөз қате',
      tooMany: 'Кіру әрекеті тым көп. Бір минут күтіп, қайталап көріңіз.',
      showPassword: 'Құпиясөзді көрсету',
      help: 'Кіруге көмек керек пе?',
      helpText:
        'Есептік жазбаларды факультет әкімшісі береді: құпиясөзді ұмытсаңыз немесе емтиханыңызды көрмесеңіз, сол көмектеседі.',
    },
  },
  en: {
    auth: {
      title: 'Welcome back',
      subtitle: 'Sign in with your university account.',
      password: 'Password',
      submit: 'Sign in',
      badCredentials: 'Wrong email or password',
      tooMany: 'Too many sign-in attempts. Wait a minute and try again.',
      showPassword: 'Show password',
      help: 'Need help signing in?',
      helpText:
        'Accounts are issued by your faculty administrator, who can also help if you forgot your password or do not see your exam.',
    },
  },
})
