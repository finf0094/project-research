import { SyncResponse, type NetState } from '@exam/contracts'
import Dexie from 'dexie'
import { ApiError, request, upload } from '@/shared/lib/http'
import type { ServerClock } from './clock'
import { initialConnection, nextConnection, retryDelay, type SyncOutcome } from './connection'
import { db } from './db'
import type { EventLog } from './event-log'

export interface SyncStatus {
  connection: NetState
  pendingEvents: number
  pendingChunks: number
  lastSyncedAt: number | null
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
const CHUNKS_PER_TICK = 3

/**
 * One request does three jobs: delivers pending events, measures the connection and fetches commands.
 * Events always go first (they carry the answers); recorded chunks follow only on a good connection.
 */
export function startSync(options: SyncOptions): SyncHandle {
  const { attemptId, log, clock } = options
  let running = true
  let connection = initialConnection
  let lastSyncedAt: number | null = null
  let wakeUp: (() => void) | null = null

  async function report(outcome: SyncOutcome) {
    const previous = connection.status
    connection = nextConnection(connection, outcome)
    if (connection.status !== previous) {
      await log.append('network.changed', { from: previous, to: connection.status })
    }
  }

  async function publish() {
    const attempt = await db.attempts.get(attemptId)
    options.onStatus({
      connection: connection.status,
      pendingEvents: Math.max(0, log.head().seq - (attempt?.ackedSeq ?? 0)),
      pendingChunks: await db.chunks.where('attemptId').equals(attemptId).count(),
      lastSyncedAt,
    })
  }

  /** Returns how long to wait before the next tick. */
  async function tick(): Promise<number> {
    const attempt = await db.attempts.get(attemptId)
    if (!attempt) return IDLE_MS
    const pending = await db.events
      .where('[attemptId+seq]')
      .between([attemptId, attempt.ackedSeq + 1], [attemptId, Dexie.maxKey])
      .limit(BATCH_SIZE)
      .toArray()
    const batch = limitBytes(pending.map(({ attemptId: _, ...event }) => event))

    const startedAt = performance.now()
    let response: SyncResponse
    try {
      response = await request(
        `/attempts/${attemptId}/sync`,
        { method: 'POST', body: { events: batch }, timeoutMs: 10_000 },
        SyncResponse,
      )
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403))
        options.onUnauthorized()
      await report({ ok: false })
      return retryDelay(connection.failures)
    }

    const rttMs = performance.now() - startedAt
    clock.sync(response.serverTime, rttMs)
    lastSyncedAt = response.serverTime
    await db.attempts.update(attemptId, {
      ackedSeq: Math.max(attempt.ackedSeq, response.ackedSeq),
      deadline: response.deadline,
      status: response.status,
      clockOffset: clock.offset(),
    })
    await report({ ok: true, rttMs })
    await options.onResponse(response)

    // After a chain break the server takes no more events; resending would only spin.
    if (response.chainBroken) return IDLE_MS
    const allAcked = response.ackedSeq >= log.head().seq
    if (allAcked && connection.status === 'online') await uploadChunks()
    return allAcked ? IDLE_MS : 0
  }

  // Chunks are accepted only after the event announcing them is on the server, hence "allAcked" above.
  async function uploadChunks() {
    const chunks = await db.chunks.where('attemptId').equals(attemptId).limit(CHUNKS_PER_TICK).toArray()
    for (const chunk of chunks) {
      try {
        await upload(`/attempts/${attemptId}/chunks/${chunk.hash}`, chunk.blob)
        await db.chunks.delete([attemptId, chunk.hash])
      } catch {
        return // try again on the next tick
      }
    }
  }

  async function loop() {
    while (running) {
      let delay: number
      try {
        delay = await tick()
        await publish()
      } catch (error) {
        console.error('sync tick failed', error)
        delay = retryDelay(connection.failures + 1)
      }
      if (!running) break
      if (delay > 0)
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, delay)
          wakeUp = () => {
            clearTimeout(timer)
            resolve()
          }
        })
      wakeUp = null
    }
  }

  void publish()
  void loop()
  return {
    wake: () => wakeUp?.(),
    stop() {
      running = false
      wakeUp?.()
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
