import { createVerify, generateKeyPairSync } from 'node:crypto';
import { resetEnvCache } from '../config/env';
import { cdnPolicyQuery } from './cdn-signer';
import { audioVariant, lessonSizes, lowVariant, needsRepackaging, packagingConfig, sizesOf, variantBytes } from './data-saver';
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
    expect(renditionHeights(1080, '720,480,360')).toEqual([720, 480, 360]);
    expect(renditionHeights(380, '720,480,360')).toEqual([]); // a 380p source is already near 360p
  });

  describe('data saver', () => {
    const v = (name: string, height: number, bandwidth: number, bytes?: number) => ({ name, height, bandwidth, bytes });
    const all = [v('source', 1080, 6_000_000, 400_000_000), v('720p', 720, 3_000_000), v('480p', 480, 1_400_000), v('360p', 360, 600_000, 30_000_000), v('audio', 0, 80_000, 4_800_000)];

    it('Low plays 360p, else the smallest picture; never with one quality, never the audio copy', () => {
      expect(lowVariant(all)?.name).toBe('360p');
      expect(lowVariant([v('source', 720, 3e6), v('480p', 480, 1e6), v('audio', 0, 8e4)])?.name).toBe('480p');
      expect(lowVariant([v('source', 720, 3e6), v('audio', 0, 8e4)])).toBeNull();
      expect(audioVariant(all)?.name).toBe('audio');
      expect(audioVariant([v('source', 720, 3e6)])).toBeNull();
    });

    it('sizes use the uploaded bytes, or the bit rate (peak = average + 25 %) times the length', () => {
      expect(variantBytes(v('x', 360, 1_000_000, 123), 600)).toBe(123);
      expect(variantBytes(v('x', 360, 1_250_000), 600)).toBe(75_000_000); // 1 Mbit/s average × 600 s / 8
      expect(lessonSizes(all, 600, 'c')).toEqual({ config: 'c', auto: 400_000_000, low: 30_000_000, audio: 4_800_000 });
      expect(lessonSizes([v('audio', 0, 8e4)], 600, 'c')).toBeNull();
      expect(lessonSizes([v('source', 720, 1_250_000)], 600, 'c')).toEqual({ config: 'c', auto: 75_000_000, low: null, audio: null });
    });

    it('marks videos packaged with other settings for re-packaging', () => {
      const now = packagingConfig(' 720, 480,360', true);
      expect(now).toBe('720,480,360+audio');
      expect(packagingConfig('720,480', false)).toBe('720,480');
      expect(needsRepackaging(null, now)).toBe(true); // before data saver
      expect(needsRepackaging({ config: '720,480', auto: 1 }, now)).toBe(true);
      expect(needsRepackaging({ config: now, auto: 1 }, now)).toBe(false);
    });

    it('sends learners only valid sizes', () => {
      expect(sizesOf({ config: 'x', auto: 10, low: 0, audio: 3 })).toEqual({ auto: 10, low: null, audio: 3 });
      expect(sizesOf({ auto: 'big' })).toBeUndefined();
      expect(sizesOf(null)).toBeUndefined();
    });
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
