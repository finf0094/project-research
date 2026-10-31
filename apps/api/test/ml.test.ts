import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadFaceCounter } from '../src/ml/faces.ts'
import { extractFrames } from '../src/ml/media.ts'
import { MODELS, modelPath } from '../src/ml/models.ts'
import { loadObjectDetector } from '../src/ml/objects.ts'

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

describe('server-side models', () => {
  it('decodes a recorded chunk into one frame per second and finds exactly one face, no phone', async () => {
    const frames = await extractFrames(portraitVideo(3))
    expect(frames.length).toBeGreaterThanOrEqual(3)
    const faces = await loadFaceCounter(modelPath(MODELS.faces))
    const objects = await loadObjectDetector(modelPath(MODELS.objects))
    expect(await faces(frames[0]!)).toBe(1)
    expect(await objects(frames[0]!)).toBe(false)
  })

  it('counts a second person', async () => {
    const [frame] = await extractFrames(portraitVideo(1, true))
    const faces = await loadFaceCounter(modelPath(MODELS.faces))
    expect(await faces(frame!)).toBe(2)
  })

  it('finds no face in an empty frame', async () => {
    const faces = await loadFaceCounter(modelPath(MODELS.faces))
    expect(await faces(Buffer.alloc(320 * 240 * 3, 200))).toBe(0)
  })
})
