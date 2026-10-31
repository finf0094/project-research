import { emptyHead, importHmacKey, sha256Hex } from '@exam/integrity'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, openEventLog } from '@/modules/offline'
import { createEvidence } from './evidence'
import type { RecordedChunk, Recorder } from './recorder'

const ATTEMPT = '00000000-0000-4000-8000-000000000002'
const chunk = (tStart: number, text: string): RecordedChunk => ({
  tStart,
  tEnd: tStart + 10_000,
  blob: new Blob([text], { type: 'video/webm' }),
})

async function setup() {
  const key = await importHmacKey(new Uint8Array(32).fill(5))
  const log = openEventLog(ATTEMPT, key, await emptyHead(ATTEMPT), () => 0)
  const ring: RecordedChunk[] = []
  const recorder: Recorder = { chunks: () => [...ring], stop: async () => undefined }
  return { log, ring, evidence: createEvidence(ATTEMPT, log, () => recorder) }
}

const fragments = async () =>
  (await db.events.where('[attemptId+seq]').between([ATTEMPT, 0], [ATTEMPT, Dexie.maxKey]).toArray()).filter(
    (e) => e.type === 'evidence.fragment',
  )

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

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
    expect(await db.chunks.where('attemptId').equals(ATTEMPT).count()).toBe(3)
  })

  it('pins what exists when the exam ends before the fragment is complete', async () => {
    const { ring, evidence } = await setup()
    ring.push(chunk(0, 'only'))
    evidence.request('control', 5_000, 40_000)
    await evidence.finish()
    expect(await fragments()).toHaveLength(1)
  })
})
