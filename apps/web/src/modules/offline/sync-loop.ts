import { SyncResponse, type AttemptStatus, type NetState } from '@exam/contracts'
import Dexie from 'dexie'
import { ApiError, isNetworkError, request } from '@/shared/lib/http'
import type { ServerClock } from './clock'
import { initialConnection, nextConnection, retryDelay, type SyncOutcome } from './connection'
import { uploadChunks } from './chunk-upload'
import { db } from './db'
import type { EventLog } from './event-log'
import { countChunks } from './local-data'

export interface SyncStatus {
  connection: NetState
  pendingEvents: number
  pendingChunks: number
}

export interface SyncOptions {
  attemptId: string
  log: EventLog
  clock: ServerClock
  /** Server state after each successful sync: status, deadline and commands. */
  onResponse(response: SyncResponse): Promise<void> | void
  onStatus(status: SyncStatus): void
  /** The session is gone (401/403); the student has to sign in again. Local data stays intact. */
  onUnauthorized(): void
}

export interface SyncHandle {
  /** Syncs now instead of waiting for the next tick, e.g. right after an answer. */
  wake(): void
  stop(): void
}

const BATCH_SIZE = 100
/** Keeps a batch well below the server body limit even with long essays. */
const BATCH_BYTES = 512 * 1024
const IDLE_MS = 4000
const OPEN: readonly AttemptStatus[] = ['active', 'terminated']

/**
 * One request does three jobs: delivers pending events, measures the connection and fetches commands.
 * Events always go first (they carry the answers). Recorded chunks follow once every event is acknowledged,
 * on a good connection — or on any connection once the attempt is submitted and nothing else is left.
 */
export function startSync(options: SyncOptions): SyncHandle {
  const { attemptId, log, clock } = options
  const aborter = new AbortController()
  let connection = initialConnection
  let wakeUp: (() => void) | null = null
  let accepting = true
  // How far a classroom hub holds the events while the cloud is away (kept here until the cloud has them).
  let relayedSeq = 0
  const running = () => !aborter.signal.aborted

  async function report(outcome: SyncOutcome) {
    const previous = connection.status
    connection = nextConnection(connection, outcome)
    // Connection changes go into the chain only while the server still accepts events.
    if (connection.status !== previous && accepting && running()) {
      await log.append('network.changed', { from: previous, to: connection.status })
    }
  }

  async function publish() {
    const attempt = await db.attempts.get(attemptId)
    if (!running()) return
    options.onStatus({
      connection: connection.status,
      pendingEvents: accepting ? Math.max(0, log.head().seq - (attempt?.ackedSeq ?? 0)) : 0,
      pendingChunks: await countChunks(attemptId),
    })
  }

  /** Returns how long to wait before the next tick. */
  async function tick(): Promise<number> {
    const attempt = await db.attempts.get(attemptId)
    if (!attempt) return IDLE_MS
    const pending = accepting
      ? await db.events
          .where('[attemptId+seq]')
          .between([attemptId, Math.max(attempt.ackedSeq, relayedSeq) + 1], [attemptId, Dexie.maxKey])
          .limit(BATCH_SIZE)
          .toArray()
      : []

    const startedAt = performance.now()
    let response: SyncResponse
    try {
      // An attempt begun without network: the server creates it (from the package's reservation) first.
      if (attempt.offlineStart) {
        await request('/attempts', {
          method: 'POST',
          body: { examId: attempt.offlineStart.examId, offlineStartedAt: attempt.offlineStart.startedAt },
          signal: aborter.signal,
        }).catch((error: unknown) => {
          // 409: the server already has this attempt (a lost reply) or will never take it; syncing says which.
          if (!(error instanceof ApiError && error.status === 409)) throw error
        })
        await db.attempts.update(attemptId, { offlineStart: null })
      }
      response = await request(
        `/attempts/${attemptId}/sync`,
        {
          method: 'POST',
          body: { events: limitBytes(pending.map(({ attemptId: _, ...event }) => event)) },
          timeoutMs: 10_000,
          signal: aborter.signal,
        },
        SyncResponse,
      )
    } catch (error) {
      if (!running()) return 0
      if (isNetworkError(error)) {
        await report({ ok: false })
        return retryDelay(connection.failures)
      }
      // The request itself was refused: the connection is fine, so it must not look like an outage.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403))
        options.onUnauthorized()
      else console.error('sync refused', error)
      return IDLE_MS
    }
    if (!running()) return 0

    clock.sync(response.serverTime, performance.now() - startedAt)
    accepting = OPEN.includes(response.status) && !response.chainBroken
    const ackedSeq = Math.max(attempt.ackedSeq, response.ackedSeq)
    const relayedBefore = relayedSeq
    relayedSeq = response.relayedSeq ?? 0
    await db.attempts.update(attemptId, {
      ackedSeq,
      deadline: response.deadline,
      status: response.status,
      clockOffset: clock.offset(),
    })
    await report({ ok: true, rttMs: performance.now() - startedAt })
    await options.onResponse(response)

    const allAcked = !accepting || ackedSeq >= log.head().seq
    if (allAcked && (connection.status === 'online' || !accepting))
      await uploadChunks(attemptId, aborter.signal, running)
    if (allAcked) return IDLE_MS
    // Not everything acknowledged: continue at once if the server moved forward, otherwise back off.
    return ackedSeq > attempt.ackedSeq || relayedSeq > relayedBefore ? 0 : retryDelay(2)
  }

  async function loop() {
    while (running()) {
      let delay: number
      try {
        delay = await tick()
        await publish()
      } catch (error) {
        console.error('sync tick failed', error)
        delay = retryDelay(connection.failures + 1)
      }
      if (!running()) break
      if (delay > 0) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, delay)
          wakeUp = () => {
            clearTimeout(timer)
            resolve()
          }
        })
      }
      wakeUp = null
    }
  }

  const wake = () => wakeUp?.()
  // The browser noticing the network is back is a good moment to try at once, not after the backoff.
  window.addEventListener('online', wake)
  void publish()
  void loop()
  return {
    wake,
    stop() {
      window.removeEventListener('online', wake)
      aborter.abort()
      wake()
    },
  }
}

/** Takes events from the front until the batch would exceed BATCH_BYTES (always at least one). */
function limitBytes<T>(events: T[]): T[] {
  let size = 0
  const batch: T[] = []
  for (const event of events) {
    size += JSON.stringify(event).length
    if (batch.length > 0 && size > BATCH_BYTES) break
    batch.push(event)
  }
  return batch
}
