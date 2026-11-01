import { z } from 'zod'

const Env = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().default(3000),
  /** 32 random bytes (base64) used to encrypt per-attempt HMAC keys at rest. */
  MASTER_KEY: z.base64().refine((v) => Buffer.from(v, 'base64').length === 32, 'MASTER_KEY must be 32 bytes'),
  STORAGE_DIR: z.string().default('./storage'),
  COOKIE_SECURE: z.stringbool().default(true),
  /**
   * How many proxies in front of the API may set the client address (X-Forwarded-For): 1 behind Caddy. A
   * count, not "trust all", so a client cannot pick its own address and slip past the sign-in limits.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  /** Events written before the deadline are accepted if they arrive within this window after it. */
  OFFLINE_WINDOW_MIN: z.coerce.number().int().nonnegative().default(15),
  /** How long fragments may still be uploaded after submission before analysis starts without them. */
  UPLOAD_WINDOW_HOURS: z.coerce.number().positive().default(24),
  RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  /** The worker refuses to start without the server-side models (on in the production image). */
  REQUIRE_MODELS: z.stringbool().default(false),
  /** LiveKit for oral exams: URL as the browser reaches it, and API credentials. Oral exams need all three. */
  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  /** Classroom hubs relay events with this shared secret; without it the relay endpoint is off. */
  HUB_TOKEN: z.string().min(32).optional(),
})

export type Config = z.infer<typeof Env>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return Env.parse(env)
}
