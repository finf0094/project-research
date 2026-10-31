import { onScopeDispose, ref } from 'vue'

/** A safety net only: the stream normally reports every change at once. */
const FALLBACK_POLL_MS = 30_000
/** Several attempts changing together (an exam opening, a burst of reconnects) give one reload. */
const BATCH_MS = 300

/**
 * Keeps a page in step with an exam's attempts through the server's event stream (SSE). The browser
 * reconnects the stream by itself; while it is down, `connected` is false and the page polls slowly.
 */
export function useLiveUpdates(examId: string, onChange: () => void) {
  const connected = ref(false)
  let batch: ReturnType<typeof setTimeout> | undefined
  const changed = () => {
    clearTimeout(batch)
    batch = setTimeout(onChange, BATCH_MS)
  }

  const source = new EventSource(`/api/examiner/exams/${examId}/stream`)
  source.addEventListener('open', () => {
    connected.value = true
    changed() // whatever happened while disconnected
  })
  source.addEventListener('error', () => (connected.value = false))
  source.addEventListener('attempt', changed)
  const poll = setInterval(onChange, FALLBACK_POLL_MS)

  onScopeDispose(() => {
    source.close()
    clearInterval(poll)
    clearTimeout(batch)
  })
  return { connected }
}
