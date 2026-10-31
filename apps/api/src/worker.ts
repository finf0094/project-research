import { loadConfig } from './config.ts'
import { createDb } from './db/client.ts'
import type { Deps } from './deps.ts'
import { analyzeNext, closeExpired, removeExpiredRecordings, removeExpiredSessions } from './jobs/jobs.ts'
import { fsStorage } from './shared/storage.ts'

// A plain polling loop: Postgres row locks (SKIP LOCKED) are the queue, so no extra queue service is needed.
const config = loadConfig()
const { db, close } = createDb(config.DATABASE_URL)
const deps: Deps = {
  db,
  config,
  storage: fsStorage(config.STORAGE_DIR),
  masterKey: Buffer.from(config.MASTER_KEY, 'base64'),
  now: Date.now,
}

const POLL_MS = 15_000
const RETENTION_EVERY_MS = 3_600_000
let stopping = false
let lastRetention = 0

async function tick() {
  await closeExpired(deps)
  while (!stopping && (await analyzeNext(deps))) {
    /* drain the ready attempts */
  }
  if (Date.now() - lastRetention > RETENTION_EVERY_MS) {
    await removeExpiredRecordings(deps)
    await removeExpiredSessions(deps)
    lastRetention = Date.now()
  }
}

process.once('SIGTERM', () => (stopping = true))
process.once('SIGINT', () => (stopping = true))

console.log('worker started')
while (!stopping) {
  try {
    await tick()
  } catch (error) {
    console.error('worker tick failed', error)
  }
  await new Promise((resolve) => setTimeout(resolve, POLL_MS))
}
await close()
