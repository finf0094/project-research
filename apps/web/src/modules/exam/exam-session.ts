import type { SyncResponse } from '@exam/contracts'
import { startSync, useSyncStore, type EventLog, type ServerClock, type SyncHandle } from '@/modules/offline'
import { keepScreenOn } from './wake-lock'

/** Everything that runs while an attempt is open on this page; `stop()` undoes all of it. */
export interface ExamSession {
  attemptId: string
  log: EventLog
  clock: ServerClock
  sync: SyncHandle
  stop(): void
}

interface Handlers {
  onResponse(response: SyncResponse): void
  onUnauthorized(): void
  /** Saves what is still typed when the page goes away. */
  onPageHide(): void
  /** Every second: the timer. */
  onTick(): void
}

/** Starts syncing, the timer, keep-screen-on and the page-hide hook for an attempt whose tab lock is held. */
export function startExamSession(
  attemptId: string,
  log: EventLog,
  clock: ServerClock,
  releaseLock: () => void,
  handlers: Handlers,
): ExamSession {
  const syncStore = useSyncStore()
  const sync = startSync({
    attemptId,
    log,
    clock,
    onResponse: handlers.onResponse,
    onStatus: syncStore.set,
    onUnauthorized: handlers.onUnauthorized,
  })
  const onPageHide = () => handlers.onPageHide()
  window.addEventListener('pagehide', onPageHide)
  const releaseScreen = keepScreenOn()
  const timer = setInterval(handlers.onTick, 1000)
  return {
    attemptId,
    log,
    clock,
    sync,
    stop() {
      sync.stop()
      clearInterval(timer)
      window.removeEventListener('pagehide', onPageHide)
      releaseLock()
      releaseScreen()
      syncStore.reset()
    },
  }
}
