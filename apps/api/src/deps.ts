import type { Config } from './config.ts'
import type { Db, Listen } from './db/client.ts'
import type { BlobStorage } from './shared/storage.ts'

/** Everything a module needs from the outside world. Passed explicitly so tests can swap any part. */
export interface Deps {
  db: Db
  config: Config
  storage: BlobStorage
  masterKey: Buffer
  now: () => number
  /** Database notifications (LISTEN), used for live monitoring. */
  listen: Listen
}

export interface ModuleOptions {
  deps: Deps
}
