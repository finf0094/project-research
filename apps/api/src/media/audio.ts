import { createReadStream } from 'node:fs'
import { mkdtemp, open, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FfmpegTimeout, ffmpeg } from './ffmpeg.ts'

/** Speech needs no more: 16 kHz mono, 16-bit. */
const RATE = 16_000
export const BYTES_PER_SECOND = RATE * 2
/** A recorded chunk is 10 s; anything longer is cut. */
const CHUNK_SECONDS = 12
/**
 * An oral answer is cut after this, the longest an exam can last (10 h; longer is a recording left
 * running). The merge streams it through a temporary file, so memory holds one chunk, not the answer.
 */
export const MAX_AUDIO_BYTES = 10 * 3600 * BYTES_PER_SECOND

/**
 * The sound of one recorded chunk as raw PCM; a chunk without sound gives an empty buffer. A chunk ffmpeg
 * cannot read gives null (it is skipped); a timeout is thrown, so the merge is tried again later.
 */
export function decodeAudio(chunk: Buffer): Promise<Buffer | null> {
  return decodeRaw(chunk).catch((error: unknown) => {
    if (error instanceof FfmpegTimeout) throw error
    return null
  })
}

function decodeRaw(chunk: Buffer): Promise<Buffer> {
  return ffmpeg(['-t', String(CHUNK_SECONDS), '-vn', '-ac', '1', '-ar', String(RATE), '-f', 's16le'], chunk, {
    maxBytes: CHUNK_SECONDS * BYTES_PER_SECOND,
    timeoutMs: 30_000,
  })
}

/** Transient failures (storage, a stuck ffmpeg) are retried this many times, then the merge is given up. */
export const MAX_AUDIO_TRIES = 3
/** A worker's claim on a merge lasts this long; a failed try waits it out before the next one. */
export const AUDIO_LEASE_MS = 15 * 60_000

/** Silence of the given length, to keep a gap in the recording as long as it was (written a minute at a time); its size in bytes. */
export async function appendSilence(append: (pcm: Buffer) => Promise<void>, ms: number) {
  const minute = Buffer.alloc(60 * BYTES_PER_SECOND)
  const total = Math.floor((ms / 1000) * RATE) * 2
  for (let left = total; left > 0; left -= minute.length)
    await append(minute.subarray(0, Math.min(left, minute.length)))
  return total
}

/**
 * Raw PCM (as from decodeAudio), appended piece by piece by `write`, to one Opus file in WebM that every
 * browser plays. The PCM goes to a temporary file, and the result to a file, not a pipe, so it gets its
 * duration and seek index: a long answer can be scrubbed. Null when `write` wrote nothing.
 */
export async function encodeOpus(write: (append: (pcm: Buffer) => Promise<void>) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'exam-audio-'))
  try {
    const pcm = join(dir, 'answer.pcm')
    const file = await open(pcm, 'w')
    let size = 0
    try {
      await write(async (piece) => {
        await file.write(piece)
        size += piece.length
      })
    } finally {
      await file.close()
    }
    if (!size) return null
    const out = join(dir, 'answer.webm')
    await ffmpeg(
      ['-c:a', 'libopus', '-b:a', '32k', '-f', 'webm'],
      createReadStream(pcm),
      { maxBytes: 1, timeoutMs: 30 * 60_000 },
      ['-f', 's16le', '-ar', String(RATE), '-ac', '1'],
      out,
    )
    return await readFile(out)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
