import type { AttemptSession, AuthoredExam, ExamPackage, StudentExam } from '@exam/contracts'
import { genesisHash, openPackage } from '@exam/integrity'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clientChain, createTestContext, seedExam, signIn, type TestContext } from './helpers.ts'

let ctx: TestContext
let seeded: Awaited<ReturnType<typeof seedExam>>
let student: { cookie: string }
let examiner: { cookie: string }

beforeEach(async () => {
  ctx = await createTestContext()
  seeded = await seedExam(ctx)
  student = await signIn(ctx.app, 'student@test.edu')
  examiner = await signIn(ctx.app, 'teacher@test.edu')
})
afterEach(() => ctx.close())

const call = (method: 'GET' | 'POST' | 'PUT', url: string, headers: { cookie: string }, payload?: object) =>
  ctx.app.inject({ method, url: `/api${url}`, headers, payload })

const download = async (): Promise<ExamPackage> =>
  (await call('GET', `/exams/${seeded.exam.id}/package`, student)).json()
const startCode = async (): Promise<string> =>
  (await call('GET', `/examiner/exams/${seeded.exam.id}/start-code`, examiner)).json().code

describe('offline start', () => {
  it('opens the downloaded exam with the start code, and keeps one reservation per student', async () => {
    const pkg = await download()
    expect((await download()).attemptId).toBe(pkg.attemptId)
    const code = await startCode()
    expect(code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/)
    const exam: StudentExam = JSON.parse(await openPackage(pkg.sealed, code, pkg.examId, pkg.iterations))
    expect(exam.questions.map((q) => q.id)).toContain(seeded.single.id)
    expect(JSON.stringify(exam)).not.toContain('"correct"') // the student's view, never the answers
    await expect(openPackage(pkg.sealed, 'WRONG-CODE0', pkg.examId, pkg.iterations)).rejects.toThrow()
  })

  it('accepts an attempt begun without network, with the events sealed offline', async () => {
    const pkg = await download()
    const startedAt = ctx.clock.now - 30_000 // the seeded exam opened a minute ago
    // What the device did offline: the chain sealed with the reserved key from the reserved attempt's genesis.
    const offline: AttemptSession = {
      attemptId: pkg.attemptId,
      hmacKey: pkg.hmacKey,
      ackedSeq: 0,
      lastHash: await genesisHash(pkg.attemptId),
    } as AttemptSession
    const chain = await clientChain(offline)
    const events = [
      await chain.next('session.started', {}, startedAt),
      await chain.next('answer', { questionId: seeded.single.id, value: 'a' }, startedAt + 20_000),
    ]

    const res = await call('POST', '/attempts', student, {
      examId: seeded.exam.id,
      offlineStartedAt: startedAt,
    })
    expect(res.statusCode, res.body).toBe(200)
    const session: AttemptSession = res.json()
    expect(session.attemptId).toBe(pkg.attemptId)
    expect(session.deadline).toBe(startedAt + 60 * 60_000)
    const sync = await call('POST', `/attempts/${pkg.attemptId}/sync`, student, { events })
    expect(sync.json()).toMatchObject({ ackedSeq: 2, chainBroken: false })
  })

  it('refuses an offline start without a package or at an implausible time', async () => {
    expect(
      (await call('POST', '/attempts', student, { examId: seeded.exam.id, offlineStartedAt: ctx.clock.now }))
        .statusCode,
    ).toBe(409) // nothing downloaded
    await download()
    const at = (offset: number) =>
      call('POST', '/attempts', student, { examId: seeded.exam.id, offlineStartedAt: ctx.clock.now + offset })
    expect((await at(10 * 60_000)).statusCode).toBe(409) // in the future
    expect((await at(-3 * 3_600_000)).statusCode).toBe(409) // longer ago than the attempt could still run
  })

  it('changes the start code when the exam is edited, so outdated packages no longer open', async () => {
    const before = await startCode()
    const { definition }: AuthoredExam = (
      await call('GET', `/examiner/exams/${seeded.exam.id}/definition`, examiner)
    ).json()
    expect(
      (await call('PUT', `/examiner/exams/${seeded.exam.id}/definition`, examiner, definition)).statusCode,
    ).toBe(204)
    expect(await startCode()).not.toBe(before)
  })
})
