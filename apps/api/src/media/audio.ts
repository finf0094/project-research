import { ffmpeg } from './ffmpeg.ts'

/** Speech needs no more: 16 kHz mono, 16-bit. */
const RATE = 16_000
const BYTES_PER_SECOND = RATE * 2
/** A recorded chunk is 10 s; anything longer is cut. */
const CHUNK_SECONDS = 12
/** An oral answer longer than this is cut (it would be a recording left running). */
const MAX_TOTAL_SECONDS = 3 * 3600

/** The sound of one recorded chunk as raw PCM; a chunk without sound gives an empty buffer. */
export function decodeAudio(chunk: Buffer): Promise<Buffer> {
  return ffmpeg(['-t', String(CHUNK_SECONDS), '-vn', '-ac', '1', '-ar', String(RATE), '-f', 's16le'], chunk, {
    maxBytes: CHUNK_SECONDS * BYTES_PER_SECOND,
    timeoutMs: 30_000,
  })
}

/** Raw PCM (as from decodeAudio) to one Opus file in WebM, which every browser plays. */
export function encodeOpus(pcm: Buffer): Promise<Buffer> {
  const limited = pcm.subarray(0, MAX_TOTAL_SECONDS * BYTES_PER_SECOND)
  return ffmpeg(
    ['-c:a', 'libopus', '-b:a', '32k', '-f', 'webm'],
    limited,
    { maxBytes: 64 * 1024 * 1024, timeoutMs: 120_000 },
    [...['-f', 's16le', '-ar', String(RATE), '-ac', '1']],
  )
}
