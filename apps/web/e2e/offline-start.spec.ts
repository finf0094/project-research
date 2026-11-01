import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

// Stage 6 of the plan: an exam downloaded ahead of time starts with no network, with the start code the
// examiner reads out. Runs against the production build (`vite preview`, its service worker caches the
// app and the models) and a fresh seed; skipped unless E2E_OFFLINE_START=1.
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

test('starts a downloaded exam without network with the examiner’s code', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(180_000)
  // The examiner's side: the code to read out.
  const examiner = await (await browser.newContext({ baseURL: PREVIEW })).newPage()
  await signIn(examiner, 'teacher@example.edu')
  await examiner.waitForURL('**/examiner')
  const exams = await (await examiner.request.get('/api/examiner/exams')).json()
  const written = exams.find(
    (e: { mode: string; title: string }) => e.mode === 'written' && !e.title.startsWith('Алгоритмы'),
  )
  const { code } = await (await examiner.request.get(`/api/examiner/exams/${written.id}/start-code`)).json()

  // Online, the home page downloads the package; the service worker takes over the app.
  await signIn(page, STUDENT)
  await page.waitForURL('**/exams')
  await expect(page.getByText('Можно начать без сети').first()).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()

  await page.goto(`/exams/${written.id}/preflight`)
  await context.setOffline(true)
  await page.getByText('Понимаю и согласен').click()
  await page.getByRole('button', { name: 'Начать экзамен' }).click({ timeout: 60_000 })

  // No network: the code from the examiner starts the exam (a wrong one does not).
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
  const attempts = await (await examiner.request.get(`/api/examiner/exams/${written.id}/attempts`)).json()
  expect(
    attempts.find((a: { student: { name: string } }) => a.student.name === 'Нурлан Ахметов'),
  ).toMatchObject({
    status: 'active',
    answered: 1,
  })
})
