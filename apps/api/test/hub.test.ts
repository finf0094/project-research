import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AttemptSession, SyncResponse } from '@exam/contracts'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { attempts, events } from '../src/db/schema.ts'
import { buildHub } from '../src/hub/app.ts'
import { forwardAll } from '../src/hub/forwarder.ts'
import { fileStore } from '../src/hub/store.ts'
import { PASSWORD, clientChain, createTestContext, seedExam, type TestContext } from './helpers.ts'

const TOKEN = 'a-hub-token-long-enough-for-the-check-000'
let ctx: TestContext
let seeded: Awaited<ReturnType<typeof seedExam>>
let cloud: string
let reachable = true
let hub: ReturnType<typeof buildHub>
let store: ReturnType<typeof fileStore>
const upstream = { url: () => (reachable ? cloud : 'http://127.0.0.1:9'), token: TOKEN }

beforeEach(async () => {
  ctx = await createTestContext()
  ctx.deps.config = { ...ctx.deps.config, HUB_TOKEN: TOKEN }
  seeded = await seedExam(ctx)
  cloud = await ctx.app.listen({ port: 0, host: '127.0.0.1' })
  reachable = true
  store = fileStore(await mkdtemp(join(tmpdir(), 'hub-')))
  hub = buildHub({ store, upstream })
})
afterEach(async () => {
  await hub.close()
  await ctx.close()
})

/** A device in the room: everything through the hub. */
async function signInThroughHub(email: string) {
  const res = await hub.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: PASSWORD },
  })
  expect(res.statusCode, res.body).toBe(200)
  return { cookie: String(res.headers['set-cookie']).split(';')[0]! }
}
const sync = (headers: { cookie: string }, attemptId: string, events: unknown[]) =>
  hub.inject({ method: 'POST', url: `/api/attempts/${attemptId}/sync`, headers, payload: { events } })
const cloudHead = async (attemptId: string) =>
  (await ctx.deps.db.select().from(attempts).where(eq(attempts.id, attemptId)))[0]!.lastSeq

describe('classroom hub', () => {
  it('keeps the room working through an internet outage and delivers everything afterwards', async () => {
    const student = await signInThroughHub('student@test.edu')
    const started = await hub.inject({
      method: 'POST',
      url: '/api/attempts',
      headers: student,
      payload: { examId: seeded.exam.id },
    })
    const session: AttemptSession = started.json()
    const chain = await clientChain(session)
    const t = ctx.clock.now
    expect(
      (await sync(student, session.attemptId, [await chain.next('session.started', {}, t)])).statusCode,
    ).toBe(200)

    // The building loses the internet: the hub answers and keeps the events.
    reachable = false
    const offline = [
      await chain.next('answer', { questionId: seeded.single.id, value: 'a' }, t + 10_000),
      await chain.next('answer', { questionId: seeded.single.id, value: 'b' }, t + 20_000),
    ]
    const kept = await sync(student, session.attemptId, offline)
    expect((kept.json() as SyncResponse).ackedSeq).toBe(3)
    expect(await cloudHead(session.attemptId)).toBe(1)
    // Nobody else can add to it, and anything but an event sync says the cloud is away.
    const neighbour = { cookie: 'sid=someone-else' }
    expect((await sync(neighbour, session.attemptId, offline)).statusCode).toBe(503)
    expect((await hub.inject({ method: 'GET', url: '/api/exams', headers: student })).statusCode).toBe(503)

    // Back online: the forwarder delivers, the cloud verifies the chain and records the hub's times.
    reachable = true
    await forwardAll(store, upstream)
    expect(await cloudHead(session.attemptId)).toBe(3)
    const rows = await ctx.deps.db.select().from(events).where(eq(events.attemptId, session.attemptId))
    expect(rows.every((e) => e.receivedAt.getTime() <= ctx.clock.now)).toBe(true) // never later than the cloud's now
    // And the device simply carries on.
    const next = await sync(student, session.attemptId, [
      await chain.next('session.submitted', {}, t + 30_000),
    ])
    expect((next.json() as SyncResponse).ackedSeq).toBe(4)
  })

  it('cannot alter what it relays: the cloud checks the chain and the token', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/hub/attempts/00000000-0000-0000-0000-000000000000/events',
      headers: { authorization: 'Bearer wrong-token-of-the-same-length-000000000' },
      payload: { events: [] },
    })
    expect(res.statusCode).toBe(401)
  })
})
