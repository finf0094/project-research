// @vitest-environment node
// Real Blobs: fake-indexeddb cannot clone happy-dom Blobs (browsers store Blobs in IndexedDB natively).
import { emptyHead, importHmacKey, sha256Hex } from '@exam/integrity'
import { describe, expect, it } from 'vitest'
import { countChunks, listEvents, listPins, listRing, openEventLog } from '@/modules/offline'
import { createEvidence } from './evidence'
import type { RecordedChunk } from './recorder'

const chunk = (tStart: number, text: string): RecordedChunk => ({
  tStart,
  tEnd: tStart + 10_000,
  blob: new Blob([text], { type: 'video/webm' }),
})
const hash = (text: string) => sha256Hex(new TextEncoder().encode(text))

// Each test uses its own attempt id, so the shared IndexedDB needs no clearing.
async function setup() {
  const attemptId = crypto.randomUUID()
  const key = await importHmacKey(new Uint8Array(32).fill(5))
  const log = openEventLog(attemptId, key, await emptyHead(attemptId), () => 0)
  const fragments = async () => (await listEvents(attemptId)).filter((e) => e.type === 'evidence.fragment')
  return { attemptId, evidence: createEvidence(attemptId, log), fragments }
}

describe('evidence', () => {
  it('waits for the future part of a fragment, then announces and queues the chunks together', async () => {
    const { attemptId, evidence, fragments } = await setup()
    await evidence.onChunk(chunk(0, 'a'))
    await evidence.onChunk(chunk(10_000, 'b'))
    await evidence.request('risk', 5_000, 25_000) // needs the chunk that ends at 30 s
    expect(await fragments()).toHaveLength(0) // request() resolves after its flush, so this is not a race
    expect(await listPins(attemptId)).toHaveLength(1) // survives a reload

    await evidence.onChunk(chunk(20_000, 'c'))
    expect(await fragments()).toHaveLength(1) // pinned as soon as the ring covers it
    await evidence.finish()
    const data = (await fragments())[0]!.data as { chunks: string[]; tStart: number; tEnd: number }
    expect(data).toMatchObject({ tStart: 0, tEnd: 30_000 })
    expect(data.chunks).toEqual([await hash('a'), await hash('b'), await hash('c')])
    expect(await countChunks(attemptId)).toBe(3)
    expect(await listRing(attemptId)).toHaveLength(0) // the ring is dropped once the exam is over
  })

  it('keeps exactly the last three minutes in the ring', async () => {
    const { attemptId, evidence } = await setup()
    for (let i = 0; i < 25; i++) await evidence.onChunk(chunk(i * 10_000, `c${i}`))
    const ring = await listRing(attemptId)
    expect(ring.map((c) => c.tStart)).toEqual(Array.from({ length: 18 }, (_, i) => 70_000 + i * 10_000))
  })

  it('pins a covered request without waiting for the end of the exam', async () => {
    const { evidence, fragments } = await setup()
    await evidence.onChunk(chunk(0, 'x'))
    await evidence.request('risk', 0, 5_000)
    expect(await fragments()).toHaveLength(1)
  })

  it('a new session after a reload finishes requests left by the previous one', async () => {
    const { attemptId, evidence, fragments } = await setup()
    await evidence.onChunk(chunk(0, 'before reload'))
    await evidence.request('control', 0, 25_000) // still waiting for chunks when the page reloads
    const key = await importHmacKey(new Uint8Array(32).fill(5))
    const [last] = (await listEvents(attemptId)).slice(-1)
    const head = last ? { seq: last.seq, hash: last.hash } : await emptyHead(attemptId)
    const reopened = createEvidence(
      attemptId,
      openEventLog(attemptId, key, head, () => 0),
    )
    await reopened.onChunk(chunk(10_000, 'after 1'))
    await reopened.onChunk(chunk(20_000, 'after 2'))
    expect(await fragments()).toHaveLength(1)
    expect(await listPins(attemptId)).toHaveLength(0)
  })

  it('pins what exists when the exam ends before the fragment is complete', async () => {
    const { evidence, fragments } = await setup()
    await evidence.onChunk(chunk(0, 'only'))
    await evidence.request('control', 5_000, 40_000)
    await evidence.finish()
    expect(await fragments()).toHaveLength(1)
  })
})
