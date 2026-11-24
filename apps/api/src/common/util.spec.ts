import { slugify, splitAmount } from './util';

describe('splitAmount (commission / instructor share)', () => {
  it('0 bps: instructor gets everything', () => {
    expect(splitAmount(4999, 0)).toEqual({ commissionCents: 0, instructorShareCents: 4999 });
  });
  it('15%: rounds commission half-up and share is the remainder', () => {
    expect(splitAmount(4999, 1500)).toEqual({ commissionCents: 750, instructorShareCents: 4249 });
  });
  it('100%: platform keeps everything', () => {
    expect(splitAmount(6999, 10000)).toEqual({ commissionCents: 6999, instructorShareCents: 0 });
  });
  it('share + commission always equals price', () => {
    for (const price of [0, 1, 99, 1234, 99999]) {
      for (const bps of [0, 1, 333, 2500, 9999, 10000]) {
        const r = splitAmount(price, bps);
        expect(r.commissionCents + r.instructorShareCents).toBe(price);
        expect(r.instructorShareCents).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('rejects invalid input', () => {
    expect(() => splitAmount(-1, 0)).toThrow();
    expect(() => splitAmount(10.5, 0)).toThrow();
    expect(() => splitAmount(100, 10001)).toThrow();
  });
});

describe('slugify', () => {
  it('makes URL-safe slugs', () => {
    expect(slugify('  AI-Powered CI/CD: GitHub Actions!  ')).toBe('ai-powered-ci-cd-github-actions');
    expect(slugify('Éléphant café')).toBe('elephant-cafe');
    expect(slugify('***')).toBe('course');
  });
});
