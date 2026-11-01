import type { AttemptSession, ExamPackage, StudentExam } from '@exam/contracts'
import { genesisHash, openPackage } from '@exam/integrity'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { attempts, exams } from '../src/db/schema.ts'
import { authoredExam, updateExam } from '../src/modules/exams/authoring.ts'
import { clientChain, createTestContext, seedExam, signIn, type TestContext } from './helpers.ts'

let ctx: TestContext
let seeded: Awaited<ReturnType<typeof seedExam>>
let student: { cookie: string }
let examiner: { cookie: string }
let opensAt: number

beforeEach(async () => {
  ctx = await createTestContext()
  seeded = await seedExam(ctx)
  // A sitting: opens in ten minutes for exactly its hour.
  opensAt = ctx.clock.now + 10 * 60_000
  await ctx.deps.db
    .update(exams)
    .set({ opensAt: new Date(opensAt), closesAt: new Date(opensAt + 60 * 60_000) })
    .where(eq(exams.id, seeded.exam.id))
  student = await signIn(ctx.app, 'student@test.edu')
  examiner = await signIn(ctx.app, 'teacher@test.edu')
})
afterEach(() => ctx.close())

const call = (method: 'GET' | 'POST' | 'PUT', url: string, headers: { cookie: string }, payload?: object) =>
  ctx.app.inject({ method, url: `/api${url}`, headers, payload })
const download = () => call('GET', `/exams/${seeded.exam.id}/package`, student)
const startCode = () => call('GET', `/examiner/exams/${seeded.exam.id}/start-code`, examiner)
const startOffline = (offlineStartedAt: number) =>
  call('POST', '/attempts', student, { examId: seeded.exam.id, offlineStartedAt })

/** Moves the clock to `at`; sessions stay valid (they last longer than these few minutes). */
const at = (time: number) => (ctx.clock.now = time)

describe('offline start: the package', () => {
  it('is offered before the sitting, and opens only with the code shown once it opens', async () => {
    const pkg: ExamPackage = (await download()).json()
    expect(((await download()).json() as ExamPackage).attemptId).toBe(pkg.attemptId) // one reservation
    expect((await startCode()).statusCode).toBe(409) // not before the exam opens

    at(opensAt)
    expect((await download()).statusCode).toBe(409) // once open, students start online
    const { code } = (await startCode()).json()
    const exam: StudentExam = JSON.parse(await openPackage(pkg.sealed, code, pkg.examId, pkg.iterations))
    expect(Object.keys(exam.questions[0]!).sort()).toEqual(['id', 'options', 'points', 'text', 'type'])
    await expect(openPackage(pkg.sealed, 'WRONG-CODE0', pkg.examId, pkg.iterations)).rejects.toThrow()
  })

  it('is refused to outsiders and for exams with a long window', async () => {
    const outsider = await signIn(ctx.app, 'outsider@test.edu')
    expect((await call('GET', `/exams/${seeded.exam.id}/package`, outsider)).statusCode).toBe(403)
    await ctx.deps.db
      .update(exams)
      .set({ closesAt: new Date(opensAt + 7 * 86_400_000) })
      .where(eq(exams.id, seeded.exam.id))
    expect((await download()).statusCode).toBe(409) // a week-long window is no sitting
  })

  // Authoring is called directly with the test clock (its routes use the real one).
  const read = () => authoredExam(ctx.deps.db, seeded.examiner.id, seeded.exam.id, ctx.clock.now)
  const edit = async () =>
    updateExam(ctx.deps.db, seeded.examiner.id, seeded.exam.id, (await read()).definition, ctx.clock.now)

  it('gets a new version when the exam is edited before it opens, so outdated packages no longer open', async () => {
    const before: ExamPackage = (await download()).json()
    expect((await read()).locked).toBe(false)
    await edit()
    expect(((await download()).json() as ExamPackage).version).not.toBe(before.version)
  })

  it('freezes the exam once it opens with packages out, before any offline attempt has synced', async () => {
    await download()
    at(opensAt)
    expect((await read()).locked).toBe(true)
    await expect(edit()).rejects.toMatchObject({ statusCode: 409 })
  })

  it('stays editable after opening when nobody downloaded a package', async () => {
    at(opensAt)
    expect((await read()).locked).toBe(false)
    await expect(edit()).resolves.toBeUndefined()
  })

  it('waits for an online start holding the exam, then sees its attempt instead of reserving another', async () => {
    // Stands in for startAttempt: the exam row under FOR SHARE while the attempt is created.
    let pending: ReturnType<typeof download> | undefined
    await ctx.deps.db.transaction(async (tx) => {
      await tx.select().from(exams).where(eq(exams.id, seeded.exam.id)).for('share')
      pending = download()
      await new Promise((resolve) => setTimeout(resolve, 200)) // the download reaches the lock and waits
      const id = crypto.randomUUID()
      await tx.insert(attempts).values({
        id,
        examId: seeded.exam.id,
        userId: seeded.student.id,
        status: 'active',
        startedAt: new Date(ctx.clock.now),
        deadline: new Date(opensAt + 60 * 60_000),
        hmacKeyEnc: Buffer.alloc(60),
        lastHash: await genesisHash(id),
        lastSeenAt: new Date(ctx.clock.now),
      })
    })
    expect((await pending!).statusCode).toBe(409)
  })
})

describe('offline start: the attempt', () => {
  it('accepts an attempt begun without network, with the events sealed offline', async () => {
    const pkg: ExamPackage = (await download()).json()
    at(opensAt + 2 * 60_000)
    const startedAt = opensAt + 30_000
    const chain = await clientChain({
      hmacKey: pkg.hmacKey,
      ackedSeq: 0,
      lastHash: await genesisHash(pkg.attemptId),
    } as AttemptSession)
    const events = [
      await chain.next('session.started', {}, startedAt),
      await chain.next('answer', { questionId: seeded.single.id, value: 'a' }, startedAt + 20_000),
    ]
    const session: AttemptSession = (await startOffline(startedAt)).json()
    // Capped by the sitting's close, not the device's start plus the hour.
    expect(session).toMatchObject({ attemptId: pkg.attemptId, deadline: opensAt + 60 * 60_000 })
    const sync = await call('POST', `/attempts/${pkg.attemptId}/sync`, student, { events })
    expect(sync.json()).toMatchObject({ ackedSeq: 2, chainBroken: false })
    const [summary] = (await call('GET', `/examiner/exams/${seeded.exam.id}/attempts`, examiner)).json()
    expect(summary).toMatchObject({ startedOffline: true, answered: 1 })
  })

  it('pulls an impossible device time into the window instead of refusing', async () => {
    await download()
    at(opensAt + 5 * 60_000)
    // Before opening becomes the opening; the deadline never passes the window's close.
    expect((await startOffline(opensAt - 3_600_000)).json().deadline).toBe(opensAt + 60 * 60_000)
  })

  it('is refused before the sitting opens, even with a package (the questions would come back)', async () => {
    await download()
    expect((await startOffline(opensAt)).statusCode).toBe(409)
  })

  it('needs a package', async () => {
    at(opensAt)
    expect((await startOffline(opensAt)).statusCode).toBe(409)
  })

  it('reuses the reservation for an online start', async () => {
    const pkg: ExamPackage = (await download()).json()
    at(opensAt)
    const session: AttemptSession = (
      await call('POST', '/attempts', student, { examId: seeded.exam.id })
    ).json()
    expect(session.attemptId).toBe(pkg.attemptId)
  })
})
