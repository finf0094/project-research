import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/** Encrypts a small secret with AES-256-GCM; output is base64(iv | tag | ciphertext). */
export function encryptSecret(masterKey: Buffer, plain: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', masterKey, iv)
  const data = Buffer.concat([cipher.update(plain), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')
}

export function decryptSecret(masterKey: Buffer, encoded: string): Buffer {
  const raw = Buffer.from(encoded, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', masterKey, raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()])
}
