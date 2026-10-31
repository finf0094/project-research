import { bigint, timestamp } from 'drizzle-orm/pg-core'

export const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
/** Event and marker times are epoch milliseconds, exactly as sealed by the client. */
export const epochMs = (name: string) => bigint(name, { mode: 'number' })
