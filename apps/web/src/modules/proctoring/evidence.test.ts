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
    expect(await fragments()).toHaveLength(0)
    expect(await listPins(attemptId)).toHaveLength(1) // survives a reload

    await evidence.onChunk(chunk(20_000, 'c'))
    await evidence.finish()
    const data = (await fragments())[0]!.data as { chunks: string[]; tStart: number; tEnd: number }
    expect(data).toMatchObject({ tStart: 0, tEnd: 30_000 })
    expect(data.chunks).toEqual([await hash('a'), await hash('b'), await hash('c')])
    expect(await countChunks(attemptId)).toBe(3)
    expect(await listRing(attemptId)).toHaveLength(0) // the ring is dropped once the exam is over
  })

  it('keeps only the last few minutes in the ring', async () => {
    const { attemptId, evidence } = await setup()
    for (let i = 0; i < 25; i++) await evidence.onChunk(chunk(i * 10_000, `c${i}`))
    const ring = await listRing(attemptId)
    expect(ring.length).toBeLessThanOrEqual(19)
    expect(ring.at(-1)!.tStart).toBe(240_000)
  })

  it('pins what exists when the exam ends before the fragment is complete', async () => {
    const { evidence, fragments } = await setup()
    await evidence.onChunk(chunk(0, 'only'))
    await evidence.request('control', 5_000, 40_000)
    await evidence.finish()
    expect(await fragments()).toHaveLength(1)
  })
})
