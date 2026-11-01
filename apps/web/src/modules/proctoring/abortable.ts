import type { EventLog } from '@/modules/offline'

// Helpers for a start that stop() may give up on halfway (proctoring.store.ts).

/** The log as seen by one start: once that start is aborted, its events are dropped. */
export function silencedOnAbort(log: EventLog, signal: AbortSignal): EventLog {
  return {
    append: (type, data, onWrite) => (signal.aborted ? Promise.resolve() : log.append(type, data, onWrite)),
    head: () => log.head(),
  }
}

/** Resolves with the value, or with null if aborted first; a value arriving after the abort is cleaned up. */
export function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  cleanup: (value: T) => void,
): Promise<T | null> {
  if (signal.aborted) {
    void promise.then(cleanup, () => undefined)
    return Promise.resolve(null)
  }
  return new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => resolve(null), { once: true })
    promise.then(
      (value) => (signal.aborted ? cleanup(value) : resolve(value)),
      (error) => (signal.aborted ? undefined : reject(error)),
    )
  })
}
