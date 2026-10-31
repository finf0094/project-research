import type { Command, SyncResponse } from '@exam/contracts'
import { emptyHead, importHmacKey } from '@exam/integrity'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAttempt, listEvents, saveAttempt, type LocalAttempt } from '@/modules/offline'
import { useExamStore } from './exam.store'

// Proctoring needs a camera; here only the order of calls matters.
const proctoring = vi.hoisted(() => ({
  start: vi.fn(async () => undefined),
  stop: vi.fn(async () => undefined),
  capture: vi.fn(),
}))
vi.mock('@/modules/proctoring', () => ({ useProctoringStore: () => proctoring }))

let ATTEMPT = ''
let server: { status: SyncResponse['status']; commands: Command[]; submits: number; deadline: number }

const questions = [
  { id: 'q1', type: 'multiple' as const, text: 'Q1', options: [{ id: 'a', text: 'A' }], points: 1 },
  { id: 'q2', type: 'text' as const, text: 'Q2', options: [], points: 1 },
]

async function seed(patch: Partial<LocalAttempt> = {}) {
  ATTEMPT = crypto.randomUUID()
  await saveAttempt(
    {
      id: ATTEMPT,
      exam: {
        id: ATTEMPT,
        title: 'T',
        durationMin: 60,
        opensAt: 0,
        closesAt: 1,
        questions,
        profile: { recording: 'adaptive' },
      },
      key: await importHmacKey(new Uint8Array(32).fill(1)),
      head: await emptyHead(ATTEMPT),
      ackedSeq: 0,
      deadline: server.deadline,
      status: 'active',
      clockOffset: 0,
      endedBy: null,
      ...patch,
    },
    {},
  )
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
const types = async () => (await listEvents(ATTEMPT)).map((e) => e.type)

beforeEach(() => {
  setActivePinia(createPinia())
  server = { status: 'active', commands: [], submits: 0, deadline: Date.now() + 3_600_000 }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/submit')) {
        server.submits++
        server.status = 'submitted'
        return json({ status: 'submitted' })
      }
      const sent = JSON.parse(String(init.body)).events as { seq: number }[]
      const acked = sent.at(-1)?.seq ?? (await getAttempt(ATTEMPT))!.ackedSeq
      return json({
        ackedSeq: acked,
        status: server.status,
        deadline: server.deadline,
        serverTime: Date.now(),
        chainBroken: false,
        commands: server.commands,
      })
    }),
  )
})
afterEach(() => {
  useExamStore().close()
  vi.unstubAllGlobals()
})

describe('exam store', () => {
  it('saves answers as events and submits once everything is acknowledged', async () => {
    await seed()
    const exam = useExamStore()
    await exam.open(ATTEMPT)
    exam.answer('q1', ['a'])
    exam.answer('q2', 'typed just before finishing')
    await exam.finish()
    await vi.waitFor(() => expect(exam.finished).toBe(true), { timeout: 10_000 })

    const log = await listEvents(ATTEMPT)
    expect(log.map((e) => e.type)).toEqual(['session.started', 'answer', 'answer', 'session.submitted'])
    expect(log[1]!.data).toEqual({ questionId: 'q1', value: ['a'] })
    expect(log[2]!.data).toEqual({ questionId: 'q2', value: 'typed just before finishing' })
    expect(exam.saveFailed).toBe(false)
    expect(server.submits).toBe(1)
    expect(exam.endedBy).toBe('student')
    expect(proctoring.stop).toHaveBeenCalled()
  })

  it('finishes by itself when the examiner terminates the attempt', async () => {
    await seed()
    server.status = 'terminated'
    const exam = useExamStore()
    await exam.open(ATTEMPT)
    await vi.waitFor(() => expect(exam.finished).toBe(true), { timeout: 10_000 })
    expect(exam.endedBy).toBe('examiner')
  })

  it('finishes by itself when time is up', async () => {
    server.deadline = Date.now() - 1000
    await seed()
    const exam = useExamStore()
    await exam.open(ATTEMPT)
    await vi.waitFor(() => expect(exam.endedBy).toBe('time'), { timeout: 10_000 })
  })

  it('shows a repeated command once and acknowledges it in the chain', async () => {
    await seed()
    server.commands = [
      { id: crypto.randomUUID(), type: 'warn', message: 'Look at the screen' },
      { id: crypto.randomUUID(), type: 'capture', seconds: 20 },
    ]
    const exam = useExamStore()
    await exam.open(ATTEMPT)
    await vi.waitFor(() => expect(exam.warning).toBe('Look at the screen'), { timeout: 10_000 })
    exam.warning = null
    await new Promise((r) => setTimeout(r, 50))
    expect(exam.warning).toBeNull()
    expect((await types()).filter((t) => t === 'command.received')).toHaveLength(2)
    expect(proctoring.capture).toHaveBeenCalledTimes(1)
  })

  it('continues submitting after a reload without reopening the session', async () => {
    await seed({ endedBy: 'student' })
    const exam = useExamStore()
    await exam.open(ATTEMPT)
    await vi.waitFor(() => expect(exam.finished).toBe(true), { timeout: 10_000 })
    expect(await types()).not.toContain('session.resumed')
    exam.answer('q1', 'a')
    expect(await types()).not.toContain('answer')
  })
})
