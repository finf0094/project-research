import { z } from 'zod'

export const Id = z.uuid()
export const Hex64 = z.string().regex(/^[0-9a-f]{64}$/)
/** SHA-256 hex digest (event hashes, chunk hashes). */
export const Sha256 = Hex64
/** Epoch milliseconds. */
export const Timestamp = z.number().int().nonnegative()
/**
 * Text that survives the whole path: well-formed unicode (hashable) and no NUL (Postgres jsonb rejects it).
 * One bad character must never make a sync batch fail forever.
 */
export const safeText = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => s.isWellFormed() && !s.includes('\u0000'), 'Text contains invalid characters')
export const ShortText = safeText(200)
