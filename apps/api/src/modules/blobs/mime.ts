import { ALLOWED_MIME } from './service.ts'

/** EBML header: WebM and Matroska (Chrome may record H.264 into `video/x-matroska`). */
const EBML = Buffer.from([0x1a, 0x45, 0xdf, 0xa3])

/**
 * The type a chunk is stored and served with: the declared one when it is a recording type (parameters
 * such as Safari's `codecs` dropped), otherwise what its first bytes say. A browser may hand over a
 * recording with an empty or generic type; refusing it would drop the chunk for good on the client and
 * count against the student as a missing fragment. Null when the body is no recording at all.
 */
export function chunkMime(header: string | undefined, body: Buffer): string | null {
  const declared = (header ?? '').split(';')[0]!.trim().toLowerCase()
  if ((ALLOWED_MIME as readonly string[]).includes(declared)) return declared
  if (body.subarray(0, 4).equals(EBML)) return 'video/webm'
  if (body.subarray(4, 8).toString('latin1') === 'ftyp') return 'video/mp4'
  return null
}
