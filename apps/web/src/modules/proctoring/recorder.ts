export interface RecordedChunk {
  tStart: number
  tEnd: number
  blob: Blob
}

export interface Recorder {
  /** Chunks still in the ring, oldest first. */
  chunks(): RecordedChunk[]
  stop(): Promise<void>
}

const CHUNK_MS = 10_000
const KEEP_MS = 3 * 60_000
const MIME_CANDIDATES = ['video/webm;codecs=vp8,opus', 'video/webm']

/**
 * Records the camera into a ring of the last few minutes, kept in memory and never sent by itself.
 * The recorder restarts every chunk, so each chunk is a standalone playable file
 * (chunks of one continuous recording would only play together with the first one).
 */
export function startRecorder(
  stream: MediaStream,
  now: () => number,
  onChunk: (chunk: RecordedChunk) => void,
): Recorder {
  const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m))
  const ring: RecordedChunk[] = []
  let running = true
  let current: MediaRecorder | null = null
  let stopped: () => void = () => undefined

  function cycle() {
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 150_000,
      audioBitsPerSecond: 24_000,
    })
    const parts: Blob[] = []
    const tStart = now()
    recorder.ondataavailable = (e) => e.data.size && parts.push(e.data)
    recorder.onstop = () => {
      const chunk = { tStart, tEnd: now(), blob: new Blob(parts, { type: recorder.mimeType }) }
      ring.push(chunk)
      while (ring.length && chunk.tEnd - ring[0]!.tEnd > KEEP_MS) ring.shift()
      onChunk(chunk)
      if (running) cycle()
      else stopped()
    }
    recorder.start()
    current = recorder
    setTimeout(() => recorder.state === 'recording' && recorder.stop(), CHUNK_MS)
  }

  cycle()
  return {
    chunks: () => [...ring],
    stop() {
      running = false
      return new Promise((resolve) => {
        stopped = resolve
        if (current?.state === 'recording') current.stop()
        else resolve()
      })
    },
  }
}
