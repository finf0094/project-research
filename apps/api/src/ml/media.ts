import { spawn } from 'node:child_process'

/** Decoded frame size: SSD sees phones better at this size; UltraFace gets a 2× downscale (`halve`). */
export const FRAME_W = 640
export const FRAME_H = 480
const FRAME_BYTES = FRAME_W * FRAME_H * 3

/** Recorded chunks are 10 s; anything longer is cut, so a crafted file cannot exhaust memory or time. */
const MAX_SECONDS = 12
const TIMEOUT_MS = 30_000

/** Decodes a recorded chunk into RGB frames (FRAME_W×FRAME_H, one per second) with ffmpeg. */
export function extractFrames(video: Buffer): Promise<Buffer[]> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      'ffmpeg',
      [
        ...['-loglevel', 'error', '-nostdin'],
        // Read only the pipe: no demuxer may open URLs or files named inside the upload.
        ...['-protocol_whitelist', 'pipe', '-i', 'pipe:0'],
        ...['-t', String(MAX_SECONDS), '-vf', `fps=1,scale=${FRAME_W}:${FRAME_H}`],
        ...['-frames:v', String(MAX_SECONDS), '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    )
    const out: Buffer[] = []
    let size = 0
    let stderr = ''
    const fail = (error: Error) => {
      ffmpeg.kill('SIGKILL')
      reject(error)
    }
    const timer = setTimeout(() => fail(new Error('ffmpeg timed out')), TIMEOUT_MS)
    ffmpeg.stdout.on('data', (d: Buffer) => {
      size += d.length
      if (size > MAX_SECONDS * FRAME_BYTES) return fail(new Error('chunk decodes to too many frames'))
      out.push(d)
    })
    ffmpeg.stderr.on('data', (d: Buffer) => (stderr = (stderr + d).slice(-2000)))
    ffmpeg.on('error', (error) => (clearTimeout(timer), reject(error)))
    ffmpeg.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) return reject(new Error(`ffmpeg exited with ${code}: ${stderr.trim()}`))
      const all = Buffer.concat(out)
      const frames: Buffer[] = []
      for (let offset = 0; offset + FRAME_BYTES <= all.length; offset += FRAME_BYTES)
        frames.push(all.subarray(offset, offset + FRAME_BYTES))
      resolve(frames)
    })
    ffmpeg.stdin.on('error', () => undefined) // ffmpeg may close stdin early on a broken file; 'close' reports it
    ffmpeg.stdin.end(video)
  })
}

/** Halves an RGB frame (2×2 box average): FRAME_W×FRAME_H → FRAME_W/2×FRAME_H/2. */
export function halve(rgb: Buffer): Buffer {
  const w = FRAME_W / 2
  const h = FRAME_H / 2
  const out = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        const at = (yy: number, xx: number) => rgb[(yy * FRAME_W + xx) * 3 + c]!
        out[(y * w + x) * 3 + c] =
          (at(2 * y, 2 * x) + at(2 * y, 2 * x + 1) + at(2 * y + 1, 2 * x) + at(2 * y + 1, 2 * x + 1) + 2) >> 2
      }
    }
  }
  return out
}
