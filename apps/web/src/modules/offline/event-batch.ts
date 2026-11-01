import Dexie from 'dexie'
import { db } from './db'

const BATCH_SIZE = 100
/** Keeps a batch well below the server body limit even with long essays. */
const BATCH_BYTES = 512 * 1024

/** The next events to send after `afterSeq`, in chain order, as the sync request carries them. */
export async function nextEvents(attemptId: string, afterSeq: number) {
  const events = await db.events
    .where('[attemptId+seq]')
    .between([attemptId, afterSeq + 1], [attemptId, Dexie.maxKey])
    .limit(BATCH_SIZE)
    .toArray()
  return limitBytes(events.map(({ attemptId: _, ...event }) => event))
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
