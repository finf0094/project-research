import { emptyHead, importHmacKey, sha256Hex } from '@exam/integrity'
import { describe, expect, it } from 'vitest'
import { countChunks, listEvents, openEventLog } from '@/modules/offline'
import { createEvidence } from './evidence'
import type { RecordedChunk, Recorder } from './recorder'

// Each test uses its own attempt id, so the shared IndexedDB needs no clearing.
let ATTEMPT = ''
const chunk = (tStart: number, text: string): RecordedChunk => ({
  tStart,
  tEnd: tStart + 10_000,
  blob: new Blob([text], { type: 'video/webm' }),
})

async function setup() {
  ATTEMPT = crypto.randomUUID()
  const key = await importHmacKey(new Uint8Array(32).fill(5))
  const log = openEventLog(ATTEMPT, key, await emptyHead(ATTEMPT), () => 0)
  const ring: RecordedChunk[] = []
  const recorder: Recorder = { chunks: () => [...ring], stop: async () => undefined }
  return { log, ring, evidence: createEvidence(ATTEMPT, log, () => recorder) }
}

const fragments = async () => (await listEvents(ATTEMPT)).filter((e) => e.type === 'evidence.fragment')

describe('evidence', () => {
  it('waits for the future part of a fragment, then announces and queues the chunks together', async () => {
    const { ring, evidence } = await setup()
    ring.push(chunk(0, 'a'), chunk(10_000, 'b'))
    evidence.request('risk', 5_000, 25_000) // needs the chunk that ends at 30 s
    await evidence.onChunk()
    expect(await fragments()).toHaveLength(0)

    ring.push(chunk(20_000, 'c'))
    evidence.onChunk()
    await evidence.finish()
    const [fragment] = await fragments()
    const data = fragment!.data as { chunks: string[]; tStart: number; tEnd: number }
    expect(data).toMatchObject({ tStart: 0, tEnd: 30_000 })
    expect(data.chunks).toEqual([
      await sha256Hex(new TextEncoder().encode('a')),
      await sha256Hex(new TextEncoder().encode('b')),
      await sha256Hex(new TextEncoder().encode('c')),
    ])
    expect(await countChunks(ATTEMPT)).toBe(3)
  })

  it('pins what exists when the exam ends before the fragment is complete', async () => {
    const { ring, evidence } = await setup()
    ring.push(chunk(0, 'only'))
    evidence.request('control', 5_000, 40_000)
    await evidence.finish()
    expect(await fragments()).toHaveLength(1)
  })
})
