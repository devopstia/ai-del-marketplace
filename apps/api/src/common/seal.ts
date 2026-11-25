import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env';

/**
 * Seals a small secret (an authenticator seed, OAuth state) with AES-256-GCM under a key derived from SESSION_SECRET and a
 * purpose label, so a database copy alone can't read it and one purpose's ciphertext can't be replayed as another's.
 * Format: base64url(iv[12] | tag[16] | ciphertext).
 */
const keyFor = (purpose: string) => createHash('sha256').update(`seal:${purpose}:${env().SESSION_SECRET}`).digest();

export function seal(purpose: string, plain: string | Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', keyFor(purpose), iv);
  const ct = Buffer.concat([c.update(typeof plain === 'string' ? Buffer.from(plain, 'utf8') : plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64url');
}

export function unseal(purpose: string, sealed: string): Buffer {
  const b = Buffer.from(sealed, 'base64url');
  const d = createDecipheriv('aes-256-gcm', keyFor(purpose), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]);
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
