import { emptyHead, importHmacKey, verifyChain } from '@exam/integrity'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServerClock } from './clock'
import { db, type LocalAttempt } from './db'
import { openEventLog } from './event-log'
import { startSync, type SyncStatus } from './sync-loop'

const ATTEMPT = '00000000-0000-4000-8000-000000000001'
const rawKey = new Uint8Array(32).fill(3)

async function setup() {
  const key = await importHmacKey(rawKey)
  const head = await emptyHead(ATTEMPT)
  const attempt: LocalAttempt = {
    id: ATTEMPT,
    exam: {
      id: ATTEMPT,
      title: 'T',
      durationMin: 60,
      opensAt: 0,
      closesAt: 1,
      questions: [],
      profile: { mode: 'written', recording: 'adaptive' },
    },
    key,
    head,
    ackedSeq: 0,
    deadline: Date.now() + 3_600_000,
    status: 'active',
    clockOffset: 0,
    endedBy: null,
  }
  await db.attempts.put(attempt)
  return { key, head, log: openEventLog(ATTEMPT, key, head, () => Date.now()) }
}

const stored = () =>
  db.events.where('[attemptId+seq]').between([ATTEMPT, 0], [ATTEMPT, Dexie.maxKey]).toArray()

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})
afterEach(() => vi.restoreAllMocks())

describe('event log', () => {
  it('writes a verifiable chain even when appends are fired concurrently', async () => {
    const { key, head, log } = await setup()
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => log.append('answer', { questionId: 'q', value: String(i) })),
    )
    const events = await stored()
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(await verifyChain(events, key, head)).toMatchObject({ ok: true })
    expect((await db.attempts.get(ATTEMPT))!.head.seq).toBe(10)
  })

  it('saves the event and its side effect together or not at all', async () => {
    const { log } = await setup()
    await expect(
      log.append('answer', { questionId: 'q', value: 'x' }, async () => {
        throw new Error('quota exceeded')
      }),
    ).rejects.toThrow()
    expect(await stored()).toHaveLength(0)
    expect(log.head().seq).toBe(0)
    // the queue keeps working after a failure
    await log.append('session.started', {})
    expect((await stored())[0]!.seq).toBe(1)
  })
})

describe('sync loop', () => {
  function respond(body: object, status = 200) {
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }
  const ok = (ackedSeq: number) =>
    respond({
      ackedSeq,
      status: 'active',
      deadline: Date.now() + 1000,
      serverTime: Date.now(),
      chainBroken: false,
      commands: [],
    })

  it('delivers events, records going offline in the chain, and uploads chunks only after the ack', async () => {
    const { log } = await setup()
    await log.append('session.started', {})
    await db.chunks.put({
      attemptId: ATTEMPT,
      hash: 'a'.repeat(64),
      tStart: 0,
      blob: new Blob(['x'], { type: 'video/webm' }),
    })

    const calls: string[] = []
    let online = false
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push(`${init.method} ${url}`)
        if (!online) throw new TypeError('Failed to fetch')
        if (init.method === 'PUT') return respond({}, 204)
        const sent = JSON.parse(String(init.body)).events as { seq: number }[]
        return ok(sent.at(-1)?.seq ?? (await db.attempts.get(ATTEMPT))!.ackedSeq)
      }),
    )

    const statuses: SyncStatus[] = []
    const handle = startSync({
      attemptId: ATTEMPT,
      log,
      clock: createServerClock(0),
      onResponse: () => undefined,
      onStatus: (s) => statuses.push(s),
      onUnauthorized: () => undefined,
    })
    // fail three times → offline
    for (let i = 0; i < 3; i++) {
      await vi.waitFor(() => expect(calls.length).toBeGreaterThan(i), { timeout: 20_000, interval: 20 })
      handle.wake()
    }
    await vi.waitFor(() => expect(statuses.at(-1)?.connection).toBe('offline'), { timeout: 20_000 })
    expect(calls.some((c) => c.startsWith('PUT'))).toBe(false)

    online = true
    for (let i = 0; i < 4; i++) {
      handle.wake()
      await new Promise((r) => setTimeout(r, 30))
    }
    await vi.waitFor(() => expect(calls.some((c) => c.startsWith('PUT'))).toBe(true), {
      timeout: 20_000,
      interval: 30,
    })
    handle.stop()

    const types = (await stored()).map((e) => e.type)
    expect(types).toContain('network.changed')
    expect((await db.attempts.get(ATTEMPT))!.ackedSeq).toBe(log.head().seq)
    expect(await db.chunks.count()).toBe(0)
  }, 60_000)
})
