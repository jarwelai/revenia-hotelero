/**
 * AES-256-GCM encryption for sensitive data (OAuth tokens).
 * Server-only — uses Node.js crypto module.
 * Key: TOKEN_ENCRYPTION_KEY (64 hex chars = 32 bytes), resolved via config (DB or env).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { getConfigValue } from '@/lib/config'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

async function getKey(): Promise<Buffer> {
  const hex = await getConfigValue('TOKEN_ENCRYPTION_KEY')
  if (!hex || hex.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  // Format: base64(iv + authTag + ciphertext)
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export async function decrypt(encoded: string): Promise<string> {
  const key = await getKey()
  const data = Buffer.from(encoded, 'base64')
  const iv = data.subarray(0, IV_LENGTH)
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}
