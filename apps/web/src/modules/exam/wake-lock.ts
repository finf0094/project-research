/**
 * Keeps the screen on during the exam (the browser drops the lock when the tab is hidden, so it is taken
 * again on return). Returns a release function; does nothing where the Wake Lock API is missing.
 */
export function keepScreenOn(): () => void {
  let sentinel: WakeLockSentinel | null = null
  let active = true
  const acquire = async () => {
    if (!active || document.visibilityState !== 'visible' || !navigator.wakeLock) return
    try {
      sentinel = await navigator.wakeLock.request('screen')
    } catch {
      /* e.g. battery saver: the exam works without it */
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
