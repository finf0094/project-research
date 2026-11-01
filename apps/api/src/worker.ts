import { loadConfig } from './config.ts'
import { createDb } from './db/client.ts'
import type { Deps } from './deps.ts'
import {
  analyzeLiveNext,
  analyzeNext,
  closeExpired,
  mergeNextAudio,
  removeExpiredRecordings,
  removeExpiredSessions,
} from './jobs/jobs.ts'
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

/** Short, so signals of a running exam turn into markers within seconds (live analysis). */
const POLL_MS = 3_000
const RETENTION_EVERY_MS = 3_600_000
let stopping = false
let lastRetention = 0
/** Ends the current pause early; replaced by every pause, so a stop signal never waits out POLL_MS. */
let wake = () => {}

async function tick() {
  await closeExpired(deps)
  while (!stopping && (await analyzeLiveNext(deps))) {
    /* rebuild the markers of running exams that got new signals or recordings */
  }
  while (!stopping && (await analyzeNext(deps))) {
    /* drain the ready attempts */
  }
  while (!stopping && (await mergeNextAudio(deps, halt.signal))) {
    /* merge the analysed oral answers */
  }
  if (!stopping && Date.now() - lastRetention > RETENTION_EVERY_MS) {
    await removeExpiredRecordings(deps)
    await removeExpiredSessions(deps)
    lastRetention = Date.now()
  }
}

// The drain loops check `stopping` before every job, so a stop lets the current job finish and then exits.
// A long audio merge is interrupted instead (it would outlast the grace period); it gives its try back.
const halt = new AbortController()
const stop = () => {
  stopping = true
  halt.abort()
  wake()
}
process.once('SIGTERM', stop)
process.once('SIGINT', stop)

// Without models every attempt would silently skip the server's second opinion; better not to start at all.
if (config.REQUIRE_MODELS && !(await loadModels())) throw new Error('ML models missing: run `pnpm models`')

console.log('worker started')
while (!stopping) {
  try {
    await tick()
  } catch (error) {
    console.error('worker tick failed', error)
  }
  if (stopping) break
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, POLL_MS)
    wake = () => {
      clearTimeout(timer)
      resolve()
    }
  })
}
await close()
