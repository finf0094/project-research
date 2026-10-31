import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createDb } from '../src/db/client.ts'

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://exam@localhost:5433/exam_test'

export default async function setup() {
  const { db, close } = createDb(TEST_DATABASE_URL)
  await db.execute(
    'drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;',
  )
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../src/db/migrations', import.meta.url)) })
  await close()
}
