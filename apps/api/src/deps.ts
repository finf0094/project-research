import type { Config } from './config.ts'
import type { Db } from './db/client.ts'
import type { BlobStorage } from './shared/storage.ts'

/** Everything a module needs from the outside world. Passed explicitly so tests can swap any part. */
export interface Deps {
  db: Db
  config: Config
  storage: BlobStorage
  masterKey: Buffer
  now: () => number
}

export interface ModuleOptions {
  deps: Deps
}
