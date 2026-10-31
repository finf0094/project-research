import { loadConfig } from './config.ts'
import { createDb } from './db/client.ts'
import type { Deps } from './deps.ts'
import { analyzeNext, closeExpired, removeExpiredRecordings, removeExpiredSessions } from './jobs/jobs.ts'
import { loadModels } from './ml/recordings.ts'
import { fsStorage } from './shared/storage.ts'

// A plain polling loop: Postgres row locks (SKIP LOCKED) are the queue, so no extra queue service is needed.
const config = loadConfig()
const { db, listen, close } = createDb(config.DATABASE_URL)
const deps: Deps = {
  db,
  config,
  storage: fsStorage(config.STORAGE_DIR),
  masterKey: Buffer.from(config.MASTER_KEY, 'base64'),
  now: Date.now,
  listen,
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

// Without models every attempt would silently skip the server's second opinion; better not to start at all.
if (config.REQUIRE_MODELS && !(await loadModels())) throw new Error('ML models missing: run `pnpm models`')

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
