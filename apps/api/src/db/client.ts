import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.ts'

export function createDb(url: string) {
  const sql = postgres(url, { max: 10 })
  return { db: drizzle(sql, { schema }), close: () => sql.end() }
}

export type Db = ReturnType<typeof createDb>['db']
/** A transaction handle; module functions accept it so callers can compose them in one transaction. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
