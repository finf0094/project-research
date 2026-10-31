import { expect, test } from '@playwright/test'

// The core promise: a student keeps answering through an outage and a reload, and nothing is lost.
// Needs a fresh seed (each student can start the exam once). Chromium's fake camera shows no face, so the
// attempt is started through the API instead of the preflight page; everything after that is the real UI.
const STUDENT = process.env.E2E_STUDENT ?? 'student2@example.edu'

test('answers survive going offline and a reload, then the exam is submitted', async ({ page, context }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(STUDENT)
  await page.getByLabel('Пароль', { exact: true }).fill('password')
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL('**/exams')

  // Start through the API directly: the fake camera has no face, so the preflight check would not pass.
  const started = await page.request.post('/api/attempts', { data: { examId: await examId(page) } })
  expect(started.ok()).toBe(true)
  const { attemptId } = await started.json()
  await page.goto(`/attempts/${attemptId}`)
  await expect(page.getByText('Всё сохранено')).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: /^Вопрос 1/ }).click()
  await page.getByText('Атомарность').click()
  await context.setOffline(true)
  await page.getByRole('button', { name: /^Вопрос 2/ }).click()
  await page.getByText('PRIMARY KEY').click()
  await expect(page.getByText(/Нет сети/)).toBeVisible({ timeout: 60_000 })

  await context.setOffline(false)
  await page.reload()
  await expect(page.getByRole('button', { name: /есть ответ/ })).toHaveCount(2)

  await page.getByRole('button', { name: 'Сдать', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Сдать' }).click()
  await expect(page.getByRole('heading', { name: /Экзамен сдан|Ответы сохранены/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Экзамен сдан' })).toBeVisible({ timeout: 30_000 })
})

async function examId(page: import('@playwright/test').Page): Promise<string> {
  const exams = await (await page.request.get('/api/exams')).json()
  return exams[0].id
}
