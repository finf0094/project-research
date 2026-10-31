import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { createDb } from './db/client.ts'
import { fsStorage } from './shared/storage.ts'

const config = loadConfig()
const { db, listen, close } = createDb(config.DATABASE_URL)
const app = await buildApp({
  db,
  config,
  storage: fsStorage(config.STORAGE_DIR),
  masterKey: Buffer.from(config.MASTER_KEY, 'base64'),
  now: Date.now,
  listen,
})

const shutdown = async () => {
  await app.close()
  await close()
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

await app.listen({ port: config.PORT, host: '0.0.0.0' })
