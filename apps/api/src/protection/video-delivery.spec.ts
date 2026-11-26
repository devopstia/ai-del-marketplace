import { createVerify, generateKeyPairSync } from 'node:crypto';
import { resetEnvCache } from '../config/env';
import { cdnPolicyQuery } from './cdn-signer';
import { renditionHeights } from './hls-packager';

const unCf = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '=').replace(/~/g, '/'), 'base64');

describe('video delivery (owner 2026-11-26)', () => {
  beforeAll(() => { Object.assign(process.env, { DATABASE_URL: 'postgres://x', SESSION_SECRET: 'x'.repeat(40) }); resetEnvCache(); });

  it('adds only qualities below the source, highest first', () => {
    expect(renditionHeights(1080, '720,480')).toEqual([720, 480]);
    expect(renditionHeights(720, '720,480')).toEqual([480]);
    expect(renditionHeights(500, '720,480')).toEqual([]); // 480 is too close to a 500p source to be worth it
    expect(renditionHeights(1080, '')).toEqual([]);
    expect(renditionHeights(2160, '480, 1080,abc,720')).toEqual([1080, 720, 480]);
  });

  it('signs one CloudFront policy for every segment of a video, verifiable with the public key', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
    const exp = new Date('2026-11-27T12:00:00Z');
    const q = new URLSearchParams(cdnPolicyQuery('https://d123.cloudfront.net/hls/abc/*', exp, 'K2ABC', privateKey));
    expect(q.get('Key-Pair-Id')).toBe('K2ABC');
    const policy = unCf(q.get('Policy')!).toString('utf8');
    expect(JSON.parse(policy)).toEqual({ Statement: [{ Resource: 'https://d123.cloudfront.net/hls/abc/*', Condition: { DateLessThan: { 'AWS:EpochTime': Math.floor(exp.getTime() / 1000) } } }] });
    expect(createVerify('RSA-SHA1').update(policy).verify(publicKey, unCf(q.get('Signature')!))).toBe(true);
    expect(q.get('Policy')).not.toMatch(/[+=/]/);
  });
});
