import { fromHex, hashEvent, type ChainHead, type SealedEvent } from './chain.ts'

export type BreakReason = 'seq' | 'prevHash' | 'hash' | 'mac'

export type VerifyResult = { ok: true } | { ok: false; reason: BreakReason }

export type ChainResult =
  { ok: true; head: ChainHead } | { ok: false; head: ChainHead; brokenAt: number; reason: BreakReason }

const encoder = new TextEncoder()

export async function verifyEvent(
  event: SealedEvent,
  head: ChainHead,
  key: CryptoKey,
): Promise<VerifyResult> {
  if (event.seq !== head.seq + 1) return { ok: false, reason: 'seq' }
  if (event.prevHash !== head.hash) return { ok: false, reason: 'prevHash' }
  if ((await hashEvent(event.prevHash, event)) !== event.hash) return { ok: false, reason: 'hash' }

  let mac: Uint8Array<ArrayBuffer>
  try {
    mac = fromHex(event.mac)
  } catch {
    return { ok: false, reason: 'mac' }
  }
  const valid = await crypto.subtle.verify('HMAC', key, mac, encoder.encode(event.hash))
  return valid ? { ok: true } : { ok: false, reason: 'mac' }
}

// Verifies events in order starting from `head`; stops at the first broken link.
// Callers must drop already-accepted events (seq <= head.seq) first: retries after a lost ack resend them.
export async function verifyChain(
  events: SealedEvent[],
  key: CryptoKey,
  head: ChainHead,
): Promise<ChainResult> {
  let current = head
  for (const event of events) {
    const result = await verifyEvent(event, current, key)
    if (!result.ok) return { ok: false, head: current, brokenAt: event.seq, reason: result.reason }
    current = { seq: event.seq, hash: event.hash }
  }
  return { ok: true, head: current }
}
