import { canonicalize } from './canonical-json.ts'

export interface EventBody {
  seq: number
  type: string
  data: unknown
  at: number
}

export interface SealedEvent extends EventBody {
  prevHash: string
  hash: string
  mac: string
}

export interface ChainHead {
  seq: number
  hash: string
}

const encoder = new TextEncoder()

/** The chain starts from a hash bound to the attempt, so a chain cannot be replayed into another attempt. */
export function genesisHash(attemptId: string): Promise<string> {
  return sha256Hex(`genesis|${attemptId}`)
}

export async function emptyHead(attemptId: string): Promise<ChainHead> {
  return { seq: 0, hash: await genesisHash(attemptId) }
}

export function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  if (!/^(?:[0-9a-f]{2})*$/.test(hex)) throw new TypeError('Invalid hex string')
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

export async function sha256Hex(data: string | Uint8Array<ArrayBuffer>): Promise<string> {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data
  return toHex(await crypto.subtle.digest('SHA-256', bytes))
}

export function hashEvent(prevHash: string, { seq, type, data, at }: EventBody): Promise<string> {
  return sha256Hex(`${prevHash}|${canonicalize({ seq, type, data, at })}`)
}

export function importHmacKey(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

/** Imports the base64 key the server sends with an attempt; works in browsers and Node. */
export function importHmacKeyBase64(base64: string): Promise<CryptoKey> {
  return importHmacKey(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)))
}

export async function sign(key: CryptoKey, hash: string): Promise<string> {
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(hash)))
}

export async function seal(body: EventBody, prevHash: string, key: CryptoKey): Promise<SealedEvent> {
  const hash = await hashEvent(prevHash, body)
  return { ...body, prevHash, hash, mac: await sign(key, hash) }
}
