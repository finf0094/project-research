import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ffmpeg } from './ffmpeg.ts'

/** Speech needs no more: 16 kHz mono, 16-bit. */
const RATE = 16_000
export const BYTES_PER_SECOND = RATE * 2
/** A recorded chunk is 10 s; anything longer is cut. */
const CHUNK_SECONDS = 12
/** An oral answer is cut after this (it would be a recording left running); also bounds memory. */
export const MAX_AUDIO_BYTES = 3 * 3600 * BYTES_PER_SECOND

/** The sound of one recorded chunk as raw PCM; a chunk without sound gives an empty buffer. */
export function decodeAudio(chunk: Buffer): Promise<Buffer> {
  return ffmpeg(['-t', String(CHUNK_SECONDS), '-vn', '-ac', '1', '-ar', String(RATE), '-f', 's16le'], chunk, {
    maxBytes: CHUNK_SECONDS * BYTES_PER_SECOND,
    timeoutMs: 30_000,
  })
}

/** Transient failures (storage, a stuck ffmpeg) are retried this many times, then the merge is given up. */
export const MAX_AUDIO_TRIES = 3
/** A worker's claim on a merge lasts this long; a failed try waits it out before the next one. */
export const AUDIO_LEASE_MS = 15 * 60_000

/** Silence of the given length, to keep a gap in the recording as long as it was. */
export const silence = (ms: number) => Buffer.alloc(Math.floor((ms / 1000) * RATE) * 2)

/**
 * Raw PCM (as from decodeAudio) to one Opus file in WebM that every browser plays. Written to a file, not a
 * pipe, so it gets its duration and seek index: an hour-long answer can be scrubbed.
 */
export async function encodeOpus(pcm: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'exam-audio-'))
  try {
    const file = join(dir, 'answer.webm')
    await ffmpeg(
      ['-c:a', 'libopus', '-b:a', '32k', '-f', 'webm'],
      pcm.subarray(0, MAX_AUDIO_BYTES),
      { maxBytes: 1, timeoutMs: 300_000 },
      ['-f', 's16le', '-ar', String(RATE), '-ac', '1'],
      file,
    )
    return await readFile(file)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
