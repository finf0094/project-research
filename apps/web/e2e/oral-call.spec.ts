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

/** Exactly one remote audio element, actually playing a live track (not blocked by autoplay rules). */
async function expectLiveSound(page: Page) {
  const audio = page.locator('body > audio')
  await expect(audio).toHaveCount(1)
  await expect
    .poll(() =>
      audio.evaluate((a: HTMLAudioElement) => {
        const track = (a.srcObject as MediaStream | null)?.getAudioTracks()[0]
        return !a.paused && track?.readyState === 'live'
      }),
    )
    .toBe(true)
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
  const oral = exams.find((e) => e.mode === 'oral')
  expect(oral, 'the seed has an oral exam (pnpm seed)').toBeDefined()
  const started = await student.request.post('/api/attempts', { data: { examId: oral!.id } })
  expect(started.ok(), 'a fresh seed: each student can start the oral exam once').toBe(true)
  const { attemptId } = await started.json()
  await student.goto(`/attempts/${attemptId}/oral`)

  const examiner = await (await browser.newContext()).newPage()
  await signIn(examiner, 'teacher@example.edu')
  await examiner.waitForURL('**/examiner')
  await examiner.goto(`/examiner/attempts/${attemptId}/room`)

  await expectLiveVideo(examiner)
  await expectLiveVideo(student)
  await expectLiveSound(examiner)
  await expectLiveSound(student)

  // After a reload the student rejoins; the examiner must not keep the old, dead audio element.
  await student.reload()
  await expectLiveVideo(student)
  await expectLiveVideo(examiner)
  await expectLiveSound(examiner)
  await expectLiveSound(student)

  await examiner.getByRole('button', { name: 'Завершить экзамен' }).click()
  await examiner.getByRole('dialog').getByRole('button', { name: 'Завершить' }).click()
  await student.waitForURL('**/done', { timeout: 30_000 })
  await expect(examiner.locator('body > audio')).toHaveCount(0)
  await expect(student.locator('body > audio')).toHaveCount(0) // the student left the room too
})
