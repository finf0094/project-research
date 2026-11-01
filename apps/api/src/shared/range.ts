/**
 * The single byte range a `Range: bytes=…` header asks for, so media players can seek: null to send
 * everything (no or an unsupported header), 'unsatisfiable' when it lies outside the data.
 */
export function byteRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | 'unsatisfiable' | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? '')
  if (!match || (!match[1] && !match[2])) return null
  const [, from, to] = match
  // "bytes=-500" is the last 500 bytes.
  const start = from ? Number(from) : Math.max(0, size - Number(to))
  const end = from && to ? Math.min(Number(to), size - 1) : size - 1
  // "bytes=5-2" is not a range at all: ignored, the whole file is sent (RFC 9110).
  if (from && to && Number(from) > Number(to)) return null
  return start > end || start >= size ? 'unsatisfiable' : { start, end }
}
