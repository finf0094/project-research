import { beforeAll, describe, expect, it } from 'vitest'
import {
  emptyHead,
  importHmacKey,
  importHmacKeyBase64,
  seal,
  type ChainHead,
  type SealedEvent,
} from './chain.ts'
import { verifyChain } from './verify.ts'

const rawKey = new Uint8Array(32).fill(7)
const ATTEMPT = '00000000-0000-4000-8000-000000000001'
let EMPTY_HEAD: ChainHead
beforeAll(async () => {
  EMPTY_HEAD = await emptyHead(ATTEMPT)
})

async function buildChain(count: number): Promise<SealedEvent[]> {
  const key = await importHmacKey(rawKey)
  const events: SealedEvent[] = []
  let prev = EMPTY_HEAD.hash
  for (let seq = 1; seq <= count; seq++) {
    const event = await seal(
      { seq, type: 'answer', data: { questionId: `q${seq}`, value: 'x' }, at: seq * 1000 },
      prev,
      key,
    )
    events.push(event)
    prev = event.hash
  }
  return events
}

describe('hash chain', () => {
  it('accepts an untouched chain', async () => {
    const key = await importHmacKey(rawKey)
    const events = await buildChain(5)
    expect(await verifyChain(events, key, EMPTY_HEAD)).toEqual({
      ok: true,
      head: { seq: 5, hash: events[4]!.hash },
    })
  })

  it('detects modified data', async () => {
    const key = await importHmacKey(rawKey)
    const events = await buildChain(3)
    events[1] = { ...events[1]!, data: { questionId: 'q2', value: 'changed' } }
    const result = await verifyChain(events, key, EMPTY_HEAD)
    expect(result).toMatchObject({ ok: false, brokenAt: 2, reason: 'hash' })
  })

  it('detects a removed event', async () => {
    const key = await importHmacKey(rawKey)
    const events = await buildChain(3)
    const result = await verifyChain([events[0]!, events[2]!], key, EMPTY_HEAD)
    expect(result).toMatchObject({ ok: false, brokenAt: 3, reason: 'seq' })
  })

  it('detects a recomputed hash without the key', async () => {
    const key = await importHmacKey(rawKey)
    const other = await importHmacKey(new Uint8Array(32).fill(9))
    const [first] = await buildChain(1)
    const forged = await seal({ ...first!, data: { forged: true } }, first!.prevHash, other)
    expect(await verifyChain([forged], key, EMPTY_HEAD)).toMatchObject({ ok: false, reason: 'mac' })
  })

  it('continues from a given head', async () => {
    const key = await importHmacKey(rawKey)
    const events = await buildChain(4)
    const head = { seq: 2, hash: events[1]!.hash }
    expect(await verifyChain(events.slice(2), key, head)).toMatchObject({ ok: true, head: { seq: 4 } })
  })
})

describe('chain binding and key import', () => {
  it('rejects a chain replayed into another attempt', async () => {
    const key = await importHmacKey(rawKey)
    const events = await buildChain(2)
    const other = await emptyHead('00000000-0000-4000-8000-000000000002')
    expect(await verifyChain(events, key, other)).toMatchObject({
      ok: false,
      brokenAt: 1,
      reason: 'prevHash',
    })
  })

  it('imports a base64 key equal to the raw key', async () => {
    const b64 = btoa(String.fromCharCode(...rawKey))
    const [event] = await buildChain(1)
    expect(await verifyChain([event!], await importHmacKeyBase64(b64), EMPTY_HEAD)).toMatchObject({
      ok: true,
    })
  })
})
