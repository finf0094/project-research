import { BYTES_PER_SECOND } from '../media/audio.ts'
import { ffmpeg } from '../media/ffmpeg.ts'

/** Decoded frame size: SSD sees phones better at this size; UltraFace gets a 2× downscale (`halve`). */
export const FRAME_W = 640
export const FRAME_H = 480
const FRAME_BYTES = FRAME_W * FRAME_H * 3

/** Recorded chunks are 10 s; anything longer is cut, so a crafted file cannot exhaust memory or time. */
const MAX_SECONDS = 12
const TIMEOUT_MS = 30_000

/** Decodes a recorded chunk into RGB frames (FRAME_W×FRAME_H, one per second) with ffmpeg. */
export async function extractFrames(video: Buffer): Promise<Buffer[]> {
  const all = await ffmpeg(
    [
      ...['-t', String(MAX_SECONDS), '-vf', `fps=1,scale=${FRAME_W}:${FRAME_H}`],
      ...['-frames:v', String(MAX_SECONDS), '-f', 'rawvideo', '-pix_fmt', 'rgb24'],
    ],
    video,
    { maxBytes: MAX_SECONDS * FRAME_BYTES, timeoutMs: TIMEOUT_MS },
  )
  const frames: Buffer[] = []
  for (let offset = 0; offset + FRAME_BYTES <= all.length; offset += FRAME_BYTES)
    frames.push(all.subarray(offset, offset + FRAME_BYTES))
  return frames
}

/** Halves an RGB frame (2×2 box average): FRAME_W×FRAME_H → FRAME_W/2×FRAME_H/2. */
export function halve(rgb: Buffer): Buffer {
  const w = FRAME_W / 2
  const h = FRAME_H / 2
  const row = FRAME_W * 3
  const out = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const top = 2 * y * row + 2 * x * 3
      const bottom = top + row
      const to = (y * w + x) * 3
      for (let c = 0; c < 3; c++)
        out[to + c] = (rgb[top + c]! + rgb[top + 3 + c]! + rgb[bottom + c]! + rgb[bottom + 3 + c]! + 2) >> 2
    }
  }
  return out
}

/**
 * Below this mean brightness (0..255) a frame is too dark to judge. The device uses 45; the server allows a
 * margin above it, as decoded frames measure a little differently: a dim room near the device's threshold
 * must not turn the device's honest silence into a discrepancy.
 */
const DARK_BRIGHTNESS = 55
/**
 * Below this a frame is nearly black: not a dim room (that still shows some light) but a lens covered by a
 * finger or tape. Such a frame is not "dark", so a missing face in it counts. The device does the same.
 */
const COVERED_BRIGHTNESS = 15

/** Dark enough that a missing face says nothing; a covered lens is not dark, it hides the student. */
export function isDark(rgb: Buffer): boolean {
  const mean = brightness(rgb)
  return mean >= COVERED_BRIGHTNESS && mean < DARK_BRIGHTNESS
}

function brightness(rgb: Buffer): number {
  let sum = 0
  let count = 0
  // Every 16th pixel is plenty for an average.
  for (let i = 0; i + 2 < rgb.length; i += 48, count++)
    sum += 0.299 * rgb[i]! + 0.587 * rgb[i + 1]! + 0.114 * rgb[i + 2]!
  return sum / count
}

/**
 * Loudness (RMS, 0..1) above which a second counts as noisy. The same as the device's threshold, so both
 * sides call the same room noisy and a quiet device is not a discrepancy for a borderline sound.
 */
const LOUD_RMS = 0.08

/** For each whole second of 16 kHz mono s16le sound (as from decodeAudio): was it loud? */
export function loudSeconds(pcm: Buffer): boolean[] {
  const loud: boolean[] = []
  for (let start = 0; start + BYTES_PER_SECOND <= pcm.length; start += BYTES_PER_SECOND) {
    let sum = 0
    for (let i = start; i < start + BYTES_PER_SECOND; i += 2) sum += (pcm.readInt16LE(i) / 32768) ** 2
    loud.push(Math.sqrt(sum / (BYTES_PER_SECOND / 2)) > LOUD_RMS)
  }
  return loud
}
