import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FRAME_H, FRAME_W, extractFrames } from '../src/ml/media.ts'
import { analyzeRecordings, loadModels } from '../src/ml/recordings.ts'
import { blobKey, fsStorage } from '../src/shared/storage.ts'

// A short WebM like the browser records, made from a portrait photo (public-domain official portrait).
// `twoPeople` puts the portrait twice side by side: a second person in the frame.
function portraitVideo(seconds: number, twoPeople = false) {
  const out = join(mkdtempSync(join(tmpdir(), 'exam-ml-')), 'clip.webm')
  const image = fileURLToPath(new URL('./fixtures/portrait.jpg', import.meta.url))
  const filter = twoPeople ? ['-filter_complex', '[0:v][0:v]hstack,scale=640:240'] : []
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-loop',
    '1',
    '-i',
    image,
    ...filter,
    '-t',
    String(seconds),
    '-c:v',
    'libvpx',
    '-b:v',
    '200k',
    '-r',
    '10',
    out,
  ])
  return readFileSync(out)
}

const models = async () => (await loadModels())!

describe('server-side models', () => {
  it('decodes a recorded chunk into one frame per second and finds exactly one face, no phone', async () => {
    const frames = await extractFrames(portraitVideo(3))
    expect(frames.length).toBeGreaterThanOrEqual(3)
    const { faces, objects } = await models()
    expect(await faces(frames[0]!)).toBe(1)
    expect(await objects(frames[0]!)).toBe(false)
  })

  it('counts a second person', async () => {
    const [frame] = await extractFrames(portraitVideo(1, true))
    expect(await (await models()).faces(frame!)).toBe(2)
  })

  it('finds no face in an empty frame', async () => {
    expect(await (await models()).faces(Buffer.alloc(FRAME_W * FRAME_H * 3, 200))).toBe(0)
  })

  it('cuts a chunk that is longer than a recorded chunk can be', async () => {
    expect((await extractFrames(portraitVideo(30))).length).toBeLessThanOrEqual(12)
  })
})

describe('analyzeRecordings', () => {
  it('places findings at the real time of each chunk, even with a gap between chunks', async () => {
    const storage = fsStorage(await mkdtemp(join(tmpdir(), 'exam-rec-')))
    const attemptId = 'a1'
    const alone = portraitVideo(3)
    const together = portraitVideo(3, true)
    await storage.put(blobKey(attemptId, 'alone'), alone)
    await storage.put(blobKey(attemptId, 'together'), together)
    // The second chunk starts 5 minutes later (e.g. after a reload), not 10 s after the first.
    const report = await analyzeRecordings(
      storage,
      attemptId,
      [{ chunks: ['alone', 'together'], chunkStarts: [100_000, 400_000] }],
      new Set(['alone', 'together']),
    )
    expect(report.status).toBe('ok')
    expect(report.findings).toEqual([{ kind: 'multiple_faces', startAt: 400_000, endAt: 403_000 }])
  })
})
