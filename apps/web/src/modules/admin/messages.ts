import { defineMessages } from '@/shared/i18n'

export const adminMessages = defineMessages({
  ru: {
    admin: {
      title: 'Пользователи',
      newUser: 'Новый пользователь',
      name: 'Имя',
      role: 'Роль',
      password: 'Пароль (не короче 8 символов)',
      create: 'Создать',
      exists: 'Пользователь с таким email уже есть.',
      roles: { student: 'Студент', examiner: 'Преподаватель', admin: 'Администратор' },
    },
  },
  kk: {
    admin: {
      title: 'Пайдаланушылар',
      newUser: 'Жаңа пайдаланушы',
      name: 'Аты',
      role: 'Рөлі',
      password: 'Құпиясөз (кемінде 8 таңба)',
      create: 'Құру',
      exists: 'Мұндай email-мен пайдаланушы бар.',
      roles: { student: 'Студент', examiner: 'Оқытушы', admin: 'Әкімші' },
    },
  },
  en: {
    admin: {
      title: 'Users',
      newUser: 'New user',
      name: 'Name',
      role: 'Role',
      password: 'Password (at least 8 characters)',
      create: 'Create',
      exists: 'A user with this email already exists.',
      roles: { student: 'Student', examiner: 'Examiner', admin: 'Administrator' },
    },
  },
})
