import { onScopeDispose, ref } from 'vue'

/** A safety net, and how a student who went silent shows up as offline (that changes no row). */
const FALLBACK_POLL_MS = 15_000
/** At most one reload per this interval, however many attempts change (an exam opening, many reconnects). */
const BATCH_MS = 500
/** After an HTTP error (API restarting, 502 from the proxy) the browser gives up; we try again. */
const RECONNECT_MS = 5_000

/**
 * Keeps a page in step with an exam's attempts through the server's event stream (SSE). The browser
 * reconnects by itself after network errors; after HTTP errors this does it. While the stream is down,
 * `connected` is false and the page relies on the periodic reload.
 */
export function useLiveUpdates(examId: string, onChange: () => void) {
  const connected = ref(true)
  let source: EventSource | null = null
  let batch: ReturnType<typeof setTimeout> | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  let opened = false

  function changed() {
    batch ??= setTimeout(() => {
      batch = undefined
      onChange()
    }, BATCH_MS)
  }

  function connect() {
    source = new EventSource(`/api/examiner/exams/${examId}/stream`)
    source.addEventListener('open', () => {
      connected.value = true
      // A reconnect may have missed changes; the first open follows the page's own load.
      if (opened) changed()
      opened = true
    })
    source.addEventListener('error', () => {
      connected.value = false
      if (source?.readyState !== EventSource.CLOSED) return
      source.close()
      retry = setTimeout(connect, RECONNECT_MS)
    })
    source.addEventListener('attempt', changed)
    source.addEventListener('resync', changed)
  }

  connect()
  const poll = setInterval(onChange, FALLBACK_POLL_MS)
  /** Ends the stream and the polling for good: when the page leaves, or the exam is gone. */
  function stop() {
    source?.close()
    clearInterval(poll)
    clearTimeout(batch)
    clearTimeout(retry)
    connected.value = false
  }
  onScopeDispose(stop)
  return { connected, stop }
}
