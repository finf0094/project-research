// Demo data for local development: one examiner, two students and an open exam.
import { loadConfig } from '../src/config.ts'
import { createDb } from '../src/db/client.ts'
import { examParticipants, exams, questions, users } from '../src/db/schema.ts'
import { hashPassword } from '../src/modules/auth/service.ts'

const PASSWORD = 'password'
const { db, close } = createDb(loadConfig().DATABASE_URL)

const passwordHash = await hashPassword(PASSWORD)
const [teacher, ...others] = await db
  .insert(users)
  .values([
    { email: 'teacher@example.edu', name: 'Айгерим Сапарова', role: 'examiner', passwordHash },
    { email: 'student1@example.edu', name: 'Нурлан Ахметов', role: 'student', passwordHash },
    { email: 'student2@example.edu', name: 'Мария Ким', role: 'student', passwordHash },
    { email: 'admin@example.edu', name: 'Администратор', role: 'admin', passwordHash },
  ])
  .returning()
const students = others.filter((u) => u.role === 'student')

const now = Date.now()
const [exam] = await db
  .insert(exams)
  .values({
    title: 'Базы данных · итоговый экзамен',
    durationMin: 90,
    opensAt: new Date(now - 3_600_000),
    closesAt: new Date(now + 7 * 86_400_000),
    profile: { mode: 'written', recording: 'adaptive' },
    ownerId: teacher!.id,
  })
  .returning()

await db.insert(questions).values([
  {
    examId: exam!.id,
    position: 1,
    type: 'single',
    text: 'Какое свойство ACID гарантирует, что транзакция выполнится целиком или не выполнится вовсе?',
    options: [
      { id: 'a', text: 'Атомарность' },
      { id: 'b', text: 'Согласованность' },
      { id: 'c', text: 'Изолированность' },
      { id: 'd', text: 'Долговечность' },
    ],
    correct: ['a'],
    points: 2,
  },
  {
    examId: exam!.id,
    position: 2,
    type: 'multiple',
    text: 'Какие из ограничений обеспечивают целостность данных?',
    options: [
      { id: 'a', text: 'PRIMARY KEY' },
      { id: 'b', text: 'FOREIGN KEY' },
      { id: 'c', text: 'ORDER BY' },
      { id: 'd', text: 'CHECK' },
    ],
    correct: ['a', 'b', 'd'],
    points: 3,
  },
  {
    examId: exam!.id,
    position: 3,
    type: 'single',
    text: 'Какая команда удаляет таблицу вместе со структурой?',
    options: [
      { id: 'a', text: 'DELETE' },
      { id: 'b', text: 'TRUNCATE' },
      { id: 'c', text: 'DROP TABLE' },
    ],
    correct: ['c'],
    points: 2,
  },
  {
    examId: exam!.id,
    position: 4,
    type: 'text',
    text: 'Объясните, как индекс ускоряет поиск и когда он может замедлить работу.',
    options: [],
    correct: [],
    points: 5,
  },
])

// Oral exam: each student draws a random ticket of two questions from the pool and answers on a video call.
const [oral] = await db
  .insert(exams)
  .values({
    title: 'Базы данных · устный экзамен',
    durationMin: 30,
    opensAt: new Date(now - 3_600_000),
    closesAt: new Date(now + 7 * 86_400_000),
    profile: { mode: 'oral', recording: 'full', ticketSize: 2 },
    ownerId: teacher!.id,
  })
  .returning()

const oralPool = [
  'Нормальные формы: что нарушает 3НФ и как это исправить?',
  'Уровни изоляции транзакций и аномалии, которые они предотвращают.',
  'Как работает B-дерево и почему оно подходит для индексов?',
  'Репликация и шардирование: в чём разница и когда что применять?',
  'Что такое план запроса и как его читать?',
]
await db.insert(questions).values(
  oralPool.map((text, i) => ({
    examId: oral!.id,
    position: i + 1,
    type: 'text' as const,
    text,
    options: [],
    correct: [],
    points: 10,
  })),
)

await db
  .insert(examParticipants)
  .values([exam!, oral!].flatMap((e) => students.map((s) => ({ examId: e.id, userId: s.id }))))
await close()
console.log(
  `Seeded. Sign in as teacher@example.edu, student1@example.edu or admin@example.edu with password "${PASSWORD}".`,
)
