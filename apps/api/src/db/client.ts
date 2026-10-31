import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.ts'

export function createDb(url: string) {
  const sql = postgres(url, { max: 10 })
  /** LISTEN on a channel (one dedicated connection, re-established by postgres.js after a drop). */
  const listen = async (channel: string, onMessage: (payload: string) => void) => {
    const { unlisten } = await sql.listen(channel, onMessage)
    return unlisten
  }
  return { db: drizzle(sql, { schema }), listen, close: () => sql.end() }
}

export type Listen = ReturnType<typeof createDb>['listen']

export type Db = ReturnType<typeof createDb>['db']
/** A transaction handle; module functions accept it so callers can compose them in one transaction. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
