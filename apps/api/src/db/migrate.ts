import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { loadConfig } from '../config.ts'
import { createDb } from './client.ts'

const { db, close } = createDb(loadConfig().DATABASE_URL)
await migrate(db, { migrationsFolder: fileURLToPath(new URL('./migrations', import.meta.url)) })
await close()
console.log('migrations applied')
