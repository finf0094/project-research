import type { EventData, EventType } from '@exam/contracts'
import { seal, type ChainHead } from '@exam/integrity'
import { db } from './db'

export interface EventLog {
  /**
   * Seals and stores an event. `onWrite` runs inside the same IndexedDB transaction,
   * so an answer and its event are saved together or not at all.
   */
  append<T extends EventType>(type: T, data: EventData<T>, onWrite?: () => Promise<unknown>): Promise<void>
  head(): ChainHead
}

/**
 * Appends are serialized through a promise queue: each event needs the previous hash.
 * Hashing (WebCrypto) happens before the IndexedDB transaction opens, because awaiting
 * a non-IndexedDB promise inside a transaction makes it commit early.
 */
export function openEventLog(
  attemptId: string,
  key: CryptoKey,
  head: ChainHead,
  now: () => number,
): EventLog {
  let current = head
  let queue: Promise<void> = Promise.resolve()

  return {
    append(type, data, onWrite) {
      const run = queue.then(async () => {
        const sealed = await seal({ seq: current.seq + 1, type, data, at: now() }, current.hash, key)
        const next = { seq: sealed.seq, hash: sealed.hash }
        await db.transaction('rw', db.events, db.attempts, db.answers, db.chunks, async () => {
          await db.events.add({ ...sealed, attemptId })
          await db.attempts.update(attemptId, { head: next })
          await onWrite?.()
        })
        current = next
      })
      queue = run.catch(() => undefined)
      return run
    },
    head: () => current,
  }
}
