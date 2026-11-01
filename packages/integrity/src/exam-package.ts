/**
 * The encrypted exam package for starting without network (offline start). The questions are downloaded
 * ahead of time, sealed with AES-256-GCM under a key derived (PBKDF2-SHA-256) from the exam's short start
 * code; the code is revealed when the exam opens — by the server, or out loud by the proctor when the room
 * has no network. Same code in the browser and on the server (WebCrypto).
 */

/** Many iterations: the package sits on the device for hours, the code must not be guessed from it. */
export const PACKAGE_ITERATIONS = 300_000
/** Crockford's base32: no I, L, O, U, so a code read aloud or from a board is not misheard. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 10

export interface SealedPackage {
  /** base64 */
  iv: string
  /** base64: ciphertext with the GCM tag appended */
  data: string
}

/** A new random start code, e.g. "7KQ2M-X9FHD" once formatted. */
export function newStartCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return [...bytes].map((b) => ALPHABET[b % 32]).join('')
}

export const formatStartCode = (code: string) => `${code.slice(0, 5)}-${code.slice(5)}`

/** What a person typed, as the code: case, spaces and dashes ignored; O read as 0, I and L as 1. */
export const normalizeStartCode = (input: string) =>
  input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')

async function deriveKey(code: string, examId: string, iterations: number, usage: KeyUsage) {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(normalizeStartCode(code)),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(`exam-package|${examId}`), iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  )
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

/** The exam id is bound in as associated data: a package cannot be passed off as another exam's. */
export async function sealPackage(
  plain: string,
  code: string,
  examId: string,
  iterations = PACKAGE_ITERATIONS,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(code, examId, iterations, 'encrypt')
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(examId) },
    key,
    new TextEncoder().encode(plain),
  )
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(data)) } satisfies SealedPackage
}

/** The package's text, or an error when the code is wrong (GCM refuses to decrypt). */
export async function openPackage(
  sealed: SealedPackage,
  code: string,
  examId: string,
  iterations = PACKAGE_ITERATIONS,
) {
  const key = await deriveKey(code, examId, iterations, 'decrypt')
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(sealed.iv), additionalData: new TextEncoder().encode(examId) },
    key,
    fromBase64(sealed.data),
  )
  return new TextDecoder().decode(plain)
}
