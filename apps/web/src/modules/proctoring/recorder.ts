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
/** WebM where the browser has it; Safari (iPhone) records MP4. The server decodes both. */
const MIME_CANDIDATES = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']

/**
 * Records the camera in 10 s chunks and hands each one over (the caller keeps the ring).
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

  function cycle() {
    const recorder = createRecorder(stream, mimeType)
    const parts: Blob[] = []
    const tStart = now()
    recorder.ondataavailable = (e) => e.data.size && parts.push(e.data)
    // `done` settles only after onstop has handed the chunk over, so stop() never races a chunk in flight.
    const done = new Promise<void>((resolve) => {
      recorder.onstop = () => {
        onChunk({ tStart, tEnd: now(), blob: new Blob(parts, { type: recorder.mimeType }) })
        resolve()
        if (running) cycle()
      }
    })
    recorder.start()
    current = { recorder, done }
    setTimeout(() => recorder.state === 'recording' && recorder.stop(), CHUNK_MS)
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
  try {
    return new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 150_000, audioBitsPerSecond: 24_000 })
  } catch (error) {
    console.warn('recording with the browser defaults', error)
    return new MediaRecorder(stream)
  }
}
