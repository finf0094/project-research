import { onScopeDispose, ref } from 'vue'

/** A safety net, and how a student who went silent shows up as offline (that changes no row). */
const FALLBACK_POLL_MS = 15_000
/** At most one reload per this interval, however many attempts change (an exam opening, many reconnects). */
const BATCH_MS = 500
/**
 * After an HTTP error (API restarting, 502 from the proxy, an expired session) the browser gives up; we try
 * again, waiting longer each time up to a minute, with jitter so the monitors of a restarted API spread out.
 */
const RECONNECT_MS = 5_000
const RECONNECT_MAX_MS = 60_000

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
  let failures = 0

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
      failures = 0
      // A reconnect may have missed changes; the first open follows the page's own load.
      if (opened) changed()
      opened = true
    })
    source.addEventListener('error', () => {
      connected.value = false
      if (source?.readyState !== EventSource.CLOSED) return
      source.close()
      const wait = Math.min(RECONNECT_MAX_MS, RECONNECT_MS * 2 ** failures++)
      retry = setTimeout(connect, wait * (0.5 + Math.random() / 2))
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
