/**
 * Keeps the screen on during the exam (the browser drops the lock when the tab is hidden, so it is taken
 * again on return). Returns a release function; does nothing where the Wake Lock API is missing.
 */
export function keepScreenOn(): () => void {
  let sentinel: WakeLockSentinel | null = null
  let requesting = false
  let active = true
  const acquire = async () => {
    if (!active || requesting || (sentinel && !sentinel.released)) return
    if (document.visibilityState !== 'visible' || !navigator.wakeLock) return
    requesting = true
    try {
      const lock = await navigator.wakeLock.request('screen')
      // Released while the request was pending: give the lock straight back.
      if (active) sentinel = lock
      else void lock.release()
    } catch {
      /* e.g. battery saver: the exam works without it */
    } finally {
      requesting = false
    }
  }
  document.addEventListener('visibilitychange', acquire)
  void acquire()
  return () => {
    active = false
    document.removeEventListener('visibilitychange', acquire)
    void sentinel?.release()
  }
}
