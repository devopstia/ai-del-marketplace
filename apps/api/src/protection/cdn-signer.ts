import { createSign } from 'node:crypto';
import { env } from '../config/env';

/**
 * CloudFront signed links for lesson video segments (docs/VIDEO_DELIVERY.md). One custom policy per playback session
 * covers every segment of that video (`hls/<prefix>/*`) until the session ends, so a manifest needs a single RSA
 * signature. The format is CloudFront's: base64 with `+ = /` replaced by `- _ ~`, signed with RSA-SHA1 by the key whose
 * public half is in the distribution's trusted key group.
 */
const cfBase64 = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/=/g, '_').replace(/\//g, '~');

export function cdnEnabled() {
  const e = env();
  return !!(e.CDN_URL && e.CDN_KEY_PAIR_ID && e.CDN_PRIVATE_KEY_B64);
}

/** Query string (without "?") that authorises GET on every URL under `resource` (may end in *) until `expiresAt`. */
export function cdnPolicyQuery(resource: string, expiresAt: Date, keyPairId = env().CDN_KEY_PAIR_ID, privateKeyPem = Buffer.from(env().CDN_PRIVATE_KEY_B64, 'base64').toString('utf8')): string {
  const policy = JSON.stringify({ Statement: [{ Resource: resource, Condition: { DateLessThan: { 'AWS:EpochTime': Math.floor(expiresAt.getTime() / 1000) } } }] });
  const signature = createSign('RSA-SHA1').update(policy).sign(privateKeyPem);
  return `Policy=${cfBase64(Buffer.from(policy))}&Signature=${cfBase64(signature)}&Key-Pair-Id=${encodeURIComponent(keyPairId)}`;
}

export const cdnBase = () => env().CDN_URL.replace(/\/$/, '');
