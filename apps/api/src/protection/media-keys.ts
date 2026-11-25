import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env';

/**
 * HLS content keys are stored only wrapped (AES-256-GCM) with a key derived from SESSION_SECRET, so a database copy alone
 * can't decrypt the videos. Format: base64(iv[12] | tag[16] | ciphertext).
 */
const wrappingKey = () => createHash('sha256').update(`media-key:${env().SESSION_SECRET}`).digest();

export function wrapKey(key: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', wrappingKey(), iv);
  const ct = Buffer.concat([c.update(key), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

export function unwrapKey(wrapped: string): Buffer {
  const b = Buffer.from(wrapped, 'base64');
  const d = createDecipheriv('aes-256-gcm', wrappingKey(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]);
}

/** One whole segment encrypted with AES-128-CBC and PKCS#7 padding: exactly HLS METHOD=AES-128. */
export function encryptSegment(data: Buffer, key: Buffer, iv: Buffer): Buffer {
  const c = createCipheriv('aes-128-cbc', key, iv);
  return Buffer.concat([c.update(data), c.final()]);
}

/** Short, readable session reference (no 0/O/1/I) for support and logs: 8 characters, about 40 bits. Never shown on video. */
export function sessionRef(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from(randomBytes(8), (b) => alphabet[b % alphabet.length]).join('');
}
