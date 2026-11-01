import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Event, SyncResponse } from '@exam/contracts'

/** What the hub keeps per attempt: whose it is, the cloud's last answer, and events not yet delivered. */
export interface HubAttempt {
  /** SHA-256 of the session cookie that last synced it through the cloud: only that student may add to it. */
  cookieHash: string
  last: SyncResponse
  pending: { event: Event; receivedAt: number }[]
}

export interface HubStore {
  get(attemptId: string): Promise<HubAttempt | null>
  put(attemptId: string, state: HubAttempt): Promise<void>
  list(): Promise<string[]>
  /** Runs `change` with no other change to the same attempt in between (requests interleave in Node). */
  update(attemptId: string, change: (state: HubAttempt | null) => Promise<HubAttempt | null>): Promise<void>
}

/** One JSON file per attempt, replaced atomically, so a power cut never leaves half a file. */
export function fileStore(dir: string): HubStore {
  const path = (id: string) => join(dir, `${id}.json`)
  const queues = new Map<string, Promise<void>>()

  const store: HubStore = {
    async get(id) {
      try {
        return JSON.parse(await readFile(path(id), 'utf8')) as HubAttempt
      } catch {
        return null
      }
    },
    async put(id, state) {
      await mkdir(dir, { recursive: true })
      await writeFile(`${path(id)}.tmp`, JSON.stringify(state))
      await rename(`${path(id)}.tmp`, path(id))
    },
    async list() {
      try {
        return (await readdir(dir)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
      } catch {
        return []
      }
    },
    update(id, change) {
      const run = (queues.get(id) ?? Promise.resolve()).then(async () => {
        const next = await change(await store.get(id))
        if (next) await store.put(id, next)
      })
      queues.set(
        id,
        run.catch(() => undefined),
      )
      return run
    },
  }
  return store
}
