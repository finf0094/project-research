import { z } from 'zod'

const Env = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().default(3000),
  /** 32 random bytes (base64) used to encrypt per-attempt HMAC keys at rest. */
  MASTER_KEY: z.base64().refine((v) => Buffer.from(v, 'base64').length === 32, 'MASTER_KEY must be 32 bytes'),
  STORAGE_DIR: z.string().default('./storage'),
  COOKIE_SECURE: z.stringbool().default(true),
  /** Behind a reverse proxy (Caddy), trust X-Forwarded-For so rate limits apply per client, not per proxy. */
  TRUST_PROXY: z.stringbool().default(false),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  /** Events written before the deadline are accepted if they arrive within this window after it. */
  OFFLINE_WINDOW_MIN: z.coerce.number().int().nonnegative().default(15),
  /** How long fragments may still be uploaded after submission before analysis starts without them. */
  UPLOAD_WINDOW_HOURS: z.coerce.number().positive().default(24),
  RETENTION_DAYS: z.coerce.number().int().positive().default(30),
})

export type Config = z.infer<typeof Env>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return Env.parse(env)
}
