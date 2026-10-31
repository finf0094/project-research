/**
 * Server time on the client. `Date.now()` can be moved by the student, so time is counted
 * from the last server timestamp with the monotonic `performance.now()`. After a reload,
 * before the first sync, the stored offset is the only reference left.
 */
export interface ServerClock {
  now(): number
  /** Re-anchors on a server timestamp; half the round trip is added as the best estimate of transit time. */
  sync(serverTime: number, rttMs?: number): void
  offset(): number
}

export function createServerClock(initialOffset: number): ServerClock {
  let baseServer = Date.now() + initialOffset
  let basePerf = performance.now()
  return {
    now: () => Math.round(baseServer + (performance.now() - basePerf)),
    sync(serverTime, rttMs = 0) {
      baseServer = serverTime + rttMs / 2
      basePerf = performance.now()
    },
    offset() {
      return this.now() - Date.now()
    },
  }
}
