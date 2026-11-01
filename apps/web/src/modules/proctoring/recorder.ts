export interface RecordedChunk {
  tStart: number
  tEnd: number
  blob: Blob
}

export interface Recorder {
  /** Resolves once the last chunk has been delivered to `onChunk`. */
  stop(): Promise<void>
}

const CHUNK_MS = 10_000
/** The shortest chunk a too-high bitrate can shrink the next one to. */
const MIN_CHUNK_MS = 2000
/** Well under the server's 5 MB per chunk: a browser that ignores the bitrate records shorter chunks instead. */
const CHUNK_BUDGET_BYTES = 3 * 1024 * 1024
/** How long a stopped recorder may take to deliver its data after the stop event (some Safari versions). */
const LATE_DATA_MS = 1000
/** WebM where the browser has it; Safari (iPhone) records MP4. The server decodes both. */
/** How often the recorder hands over data within a chunk. */
const TIMESLICE_MS = 1000
const MIME_CANDIDATES = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']

/**
 * Records the camera in chunks of up to 10 s and hands each one over (the caller keeps the ring).
 * The recorder restarts every chunk, so each chunk is a standalone playable file
 * (chunks of one continuous recording would only play together with the first one).
 */
export function startRecorder(
  stream: MediaStream,
  now: () => number,
  onChunk: (chunk: RecordedChunk) => void,
): Recorder {
  const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m))
  let running = true
  let current: { recorder: MediaRecorder; done: Promise<void> } | null = null
  let chunkMs = CHUNK_MS

  function cycle() {
    const recorder = createRecorder(stream, mimeType)
    const parts: Blob[] = []
    const tStart = now()
    let stopped = false
    // `done` settles only after the chunk has been handed over, so stop() never races a chunk in flight.
    const done = new Promise<void>((resolve) => {
      let delivered = false
      const deliver = () => {
        if (delivered) return
        delivered = true
        const blob = new Blob(parts, { type: recorder.mimeType || mimeType })
        // An empty chunk would be announced as evidence with no picture, and every empty chunk has the same
        // hash, so a whole exam of them uploads as one empty file: nothing is kept for it.
        if (blob.size) onChunk({ tStart, tEnd: now(), blob })
        else console.warn('the browser recorded nothing for a chunk')
        chunkMs = nextChunkMs(chunkMs, blob.size)
        resolve()
        if (running) cycle()
      }
      recorder.ondataavailable = (e) => {
        if (e.data.size) parts.push(e.data)
        if (stopped) deliver()
      }
      // The spec delivers the data before `stop`; where it comes after (some Safari versions), wait for it.
      recorder.onstop = () => {
        stopped = true
        if (parts.length) deliver()
        else setTimeout(deliver, LATE_DATA_MS)
      }
    })
    current = { recorder, done }
    try {
      // Data every second, joined into one file per chunk: Safari on iPhone may hand over nothing at all
      // when asked only at stop, which left whole exams with empty recordings.
      recorder.start(TIMESLICE_MS)
    } catch (error) {
      // iOS may refuse to start while the page is in the background: the next chunk tries again.
      console.warn('recording paused', error)
      current = null
      if (running) setTimeout(() => running && cycle(), CHUNK_MS)
      return
    }
    setTimeout(() => recorder.state === 'recording' && recorder.stop(), chunkMs)
  }

  cycle()
  return {
    async stop() {
      running = false
      if (current?.recorder.state === 'recording') current.recorder.stop()
      await current?.done
    },
  }
}

/** A browser that refuses the requested format or bitrates (some Safari versions) records with its defaults. */
function createRecorder(stream: MediaStream, mimeType: string | undefined) {
  const bitrates = { videoBitsPerSecond: 150_000, audioBitsPerSecond: 24_000 }
  try {
    return new MediaRecorder(stream, { mimeType, ...bitrates })
  } catch (error) {
    console.warn('recording with the browser defaults', error)
  }
  try {
    return new MediaRecorder(stream, bitrates)
  } catch {
    return new MediaRecorder(stream)
  }
}

/** Keeps chunks under the budget where the browser records at a higher bitrate than asked (or its default). */
export function nextChunkMs(chunkMs: number, bytes: number): number {
  if (!bytes) return chunkMs
  const fitting = Math.floor((chunkMs * CHUNK_BUDGET_BYTES) / bytes)
  return Math.min(CHUNK_MS, Math.max(MIN_CHUNK_MS, fitting))
}
