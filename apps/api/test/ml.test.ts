import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildMarkers, riskScore, type StoredEvent } from '../src/jobs/analysis.ts'
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
      [
        {
          reason: 'risk',
          tStart: 100_000,
          tEnd: 410_000,
          chunks: ['alone', 'together'],
          chunkStarts: [100_000, 400_000],
        },
      ],
      new Set(['alone', 'together']),
    )
    expect(report.status).toBe('ok')
    expect([...report.checked].sort()).toEqual(['alone', 'together'])
    expect(report.findings).toEqual([{ kind: 'multiple_faces', startAt: 400_000, endAt: 403_000 }])
  })
})

describe("reconciling the server's findings with the device", () => {
  const ev = (seq: number, type: string, data: unknown, clientAt: number): StoredEvent => ({
    seq,
    type,
    data,
    clientAt,
  })
  const signal = (kind: string, from: number, to: number) => [
    ev(1, 'proctor.signal', { kind, active: true }, from),
    ev(2, 'proctor.signal', { kind, active: false }, to),
  ]
  const control = ev(
    3,
    'evidence.fragment',
    { reason: 'control', tStart: 0, tEnd: 70_000, chunks: ['c'], chunkStarts: [0] },
    70_000,
  )
  const opts = { endAt: 70_000, uploaded: new Set(['c']), chainBrokenAt: null }

  it('does not let the device hide missing faces by reporting darkness', () => {
    const markers = buildMarkers([...signal('too_dark', 0, 60_000), control], {
      ...opts,
      serverFindings: [{ kind: 'face_missing', startAt: 5000, endAt: 20_000 }],
    })
    expect(markers).toContainEqual(
      expect.objectContaining({ kind: 'face_missing', source: 'model', discrepancy: true }),
    )
  })

  it('holds a device that never reported its tier to the strictest one', () => {
    const markers = buildMarkers([control], {
      ...opts,
      serverFindings: [{ kind: 'object_detected', startAt: 2000, endAt: 62_000 }],
    })
    expect(markers).toEqual([
      expect.objectContaining({ kind: 'object_detected', source: 'model', discrepancy: true }),
    ])
  })

  it('shows a confirmed finding on the timeline without counting it twice in the score', () => {
    const reported = buildMarkers([...signal('multiple_faces', 1000, 61_000), control], opts)
    const confirmed = buildMarkers([...signal('multiple_faces', 1000, 61_000), control], {
      ...opts,
      serverFindings: [{ kind: 'multiple_faces', startAt: 2000, endAt: 60_000 }],
    })
    expect(confirmed).toContainEqual(
      expect.objectContaining({ kind: 'multiple_faces', source: 'model', discrepancy: false }),
    )
    expect(riskScore(confirmed)).toBe(riskScore(reported))
    expect(riskScore(reported)).toBeGreaterThan(0)
  })
})
