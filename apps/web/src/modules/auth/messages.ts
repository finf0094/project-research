import { defineMessages } from '@/shared/i18n'

export const authMessages = defineMessages({
  ru: {
    auth: {
      title: 'С возвращением',
      subtitle: 'Войдите через учётную запись университета.',
      password: 'Пароль',
      submit: 'Войти',
      badCredentials: 'Неверный email или пароль',
      offline: 'Нет связи с сервером. Попробуйте ещё раз.',
    },
  },
  kk: {
    auth: {
      title: 'Қош келдіңіз',
      subtitle: 'Университеттің есептік жазбасымен кіріңіз.',
      password: 'Құпиясөз',
      submit: 'Кіру',
      badCredentials: 'Email немесе құпиясөз қате',
      offline: 'Сервермен байланыс жоқ. Қайталап көріңіз.',
    },
  },
  en: {
    auth: {
      title: 'Welcome back',
      subtitle: 'Sign in with your university account.',
      password: 'Password',
      submit: 'Sign in',
      badCredentials: 'Wrong email or password',
      offline: 'No connection to the server. Please try again.',
    },
  },
})
