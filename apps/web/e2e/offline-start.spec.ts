import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

// Stage 6 of the plan: an exam downloaded ahead of time starts with no network, with the start code the
// examiner reads out. Runs against the production build (`vite preview`, its service worker caches the
// app and the models); it schedules its own sitting, so no fresh seed is needed. Skipped unless
// E2E_OFFLINE_START=1.
test.skip(!process.env.E2E_OFFLINE_START, 'needs `vite preview` of a fresh build (set E2E_OFFLINE_START=1)')

const STUDENT = process.env.E2E_OFFLINE_STUDENT ?? 'student1@example.edu'
const PREVIEW = process.env.E2E_PREVIEW_URL ?? 'http://localhost:4173'

// Chromium's fake camera shows no face; a still portrait as the camera lets the preflight check pass.
const face = join(mkdtempSync(join(tmpdir(), 'face-')), 'face.y4m')
execFileSync('ffmpeg', [
  ...[
    '-loglevel',
    'error',
    '-loop',
    '1',
    '-i',
    resolve(import.meta.dirname, '../../api/test/fixtures/portrait.jpg'),
  ],
  ...['-t', '2', '-r', '10', '-vf', 'scale=640:480,format=yuv420p', '-y', face],
])
test.use({
  baseURL: PREVIEW,
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${face}`,
    ],
  },
})

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль', { exact: true }).fill('password')
  await page.getByRole('button', { name: 'Войти' }).click()
}

test('starts a downloaded sitting without network with the examiner’s code', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(180_000)
  // The examiner schedules a sitting that opens in 40 s, for the student.
  const examiner = await (await browser.newContext({ baseURL: PREVIEW })).newPage()
  await signIn(examiner, 'teacher@example.edu')
  await examiner.waitForURL('**/examiner')
  const opensAt = Date.now() + 40_000
  const created = await examiner.request.post('/api/examiner/exams', {
    data: {
      title: 'Сессия без сети',
      durationMin: 30,
      opensAt,
      closesAt: opensAt + 30 * 60_000,
      profile: { mode: 'written', recording: 'adaptive' },
      questions: [
        {
          type: 'single',
          text: 'Какое свойство ACID отвечает за «всё или ничего»?',
          options: [
            { id: 'a', text: 'Атомарность' },
            { id: 'b', text: 'Изолированность' },
          ],
          correct: ['a'],
          points: 2,
        },
      ],
    },
  })
  expect(created.ok(), await created.text()).toBe(true)
  const { id: examId } = await created.json()
  await examiner.request.put(`/api/examiner/exams/${examId}/participants`, { data: { emails: [STUDENT] } })

  // Before the sitting, online: the home page downloads the package; the service worker takes over.
  await signIn(page, STUDENT)
  await page.waitForURL('**/exams')
  await expect(page.getByText('Можно начать без сети').first()).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.goto(`/exams/${examId}/preflight`)
  await page.getByText('Понимаю и согласен').click()

  // The sitting opens; the examiner can now read out the code. The room has no network.
  await page.waitForTimeout(Math.max(0, opensAt - Date.now() + 1000))
  const { code } = await (await examiner.request.get(`/api/examiner/exams/${examId}/start-code`)).json()
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Начать экзамен' }).click({ timeout: 60_000 })

  // The code starts the exam (a wrong one does not).
  await page.getByLabel('Код старта').fill('WRONG-CODE0')
  await page.getByRole('button', { name: 'Начать без сети' }).click()
  await expect(page.getByText('Код не подходит')).toBeVisible()
  await page.getByLabel('Код старта').fill(code.toLowerCase())
  await page.getByRole('button', { name: 'Начать без сети' }).click()
  await page.waitForURL(/\/attempts\/[0-9a-f-]+$/)
  await page.getByText('Атомарность').click()
  await expect(page.getByText(/Ответ сохранён/)).toBeVisible()

  // Back online: the server creates the attempt and receives the answer written offline.
  await context.setOffline(false)
  await expect(page.getByText('Всё сохранено')).toBeVisible({ timeout: 60_000 })
  const [attempt] = await (await examiner.request.get(`/api/examiner/exams/${examId}/attempts`)).json()
  expect(attempt).toMatchObject({ status: 'active', answered: 1, startedOffline: true })
})
