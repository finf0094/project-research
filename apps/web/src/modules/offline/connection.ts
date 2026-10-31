import type { NetState } from '@exam/contracts'

export interface ConnectionState {
  status: NetState
  failures: number
  successes: number
}

export type SyncOutcome = { ok: true; rttMs: number } | { ok: false }

const SLOW_RTT_MS = 800
const OFFLINE_AFTER_FAILURES = 3
const ONLINE_AFTER_SUCCESSES = 2

export const initialConnection: ConnectionState = { status: 'online', failures: 0, successes: 0 }

/**
 * Connection state from real sync requests (navigator.onLine only knows about a network interface).
 * Recovery needs two successes in a row so a flapping network does not bounce the UI.
 */
export function nextConnection(state: ConnectionState, outcome: SyncOutcome): ConnectionState {
  if (!outcome.ok) {
    const failures = state.failures + 1
    return {
      status: failures >= OFFLINE_AFTER_FAILURES || state.status === 'offline' ? 'offline' : 'slow',
      failures,
      successes: 0,
    }
  }
  const successes = state.successes + 1
  const recovered = state.status === 'online' || successes >= ONLINE_AFTER_SUCCESSES
  const status: NetState = outcome.rttMs >= SLOW_RTT_MS || !recovered ? 'slow' : 'online'
  return { status, failures: 0, successes }
}

/** Retry delay after failures: exponential up to 30 s, with jitter so a classroom does not retry in lockstep. */
export function retryDelay(failures: number, random = Math.random): number {
  const base = Math.min(30_000, 1000 * 2 ** Math.max(0, failures - 1))
  return Math.round(base * (0.75 + random() * 0.5))
}
