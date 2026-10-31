import { expect, test, type Page } from '@playwright/test'

// The oral exam's live call through a real LiveKit server: both sides see each other, the call survives a
// reload, and ending the exam closes it. Needs a running LiveKit (`livekit-server --dev`) and the API's
// LIVEKIT_* settings, plus a fresh seed; skipped unless E2E_LIVEKIT=1.
test.skip(!process.env.E2E_LIVEKIT, 'needs a LiveKit server (set E2E_LIVEKIT=1)')

const STUDENT = process.env.E2E_ORAL_STUDENT ?? 'student1@example.edu'

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill('password')
  await page.getByRole('button', { name: 'Войти' }).click()
}

/** The remote <video> plays real frames: it has a size and its time moves on. */
async function expectLiveVideo(page: Page) {
  const video = page.locator('.room video')
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 30_000 })
    .toBeGreaterThan(0)
  const before = await video.evaluate((v: HTMLVideoElement) => v.currentTime)
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(before)
}

test('student and examiner see each other, the call survives a reload and ends with the exam', async ({
  browser,
}) => {
  const student = await (await browser.newContext()).newPage()
  await signIn(student, STUDENT)
  await student.waitForURL('**/exams')
  // Started through the API: Chromium's fake camera shows no face, so the preflight check would not pass.
  const exams: { id: string; mode: string }[] = await (await student.request.get('/api/exams')).json()
  const oral = exams.find((e) => e.mode === 'oral')!
  const started = await student.request.post('/api/attempts', { data: { examId: oral.id } })
  expect(started.ok()).toBe(true)
  const { attemptId } = await started.json()
  await student.goto(`/attempts/${attemptId}/oral`)

  const examiner = await (await browser.newContext()).newPage()
  await signIn(examiner, 'teacher@example.edu')
  await examiner.waitForURL('**/examiner')
  await examiner.goto(`/examiner/attempts/${attemptId}/room`)

  await expectLiveVideo(examiner)
  await expectLiveVideo(student)
  await expect(examiner.locator('body > audio')).toHaveCount(1)

  await student.reload()
  await expectLiveVideo(student)
  await expectLiveVideo(examiner)

  await examiner.getByRole('button', { name: 'Завершить экзамен' }).click()
  await examiner.getByRole('dialog').getByRole('button', { name: 'Завершить' }).click()
  await student.waitForURL('**/done', { timeout: 30_000 })
  await expect(examiner.locator('body > audio')).toHaveCount(0)
})
