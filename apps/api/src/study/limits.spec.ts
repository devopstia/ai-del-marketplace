import { limitDecision, startOfUtcDay } from './limits';

describe('course assistant rate limits', () => {
  const limits = { perMinute: 5, perDay: 40, platformPerDay: 1000 };
  const now = new Date('2026-11-27T22:00:00Z');

  it('allows within limits and reports what is left today', () => {
    expect(limitDecision({ lastMinute: 1, today: 10, platformToday: 50 }, limits, now)).toEqual({ ok: true, remainingToday: 30 });
    expect(limitDecision({ lastMinute: 5, today: 40, platformToday: 1000 }, limits, now)).toEqual({ ok: true, remainingToday: 0 });
  });

  it('blocks a burst for a minute', () => {
    expect(limitDecision({ lastMinute: 6, today: 6, platformToday: 6 }, limits, now)).toMatchObject({ ok: false, reason: 'minute', retryAfterSec: 60 });
  });

  it('blocks after the daily cap until 00:00 UTC', () => {
    expect(limitDecision({ lastMinute: 1, today: 41, platformToday: 100 }, limits, now)).toMatchObject({ ok: false, reason: 'day', retryAfterSec: 2 * 3600 });
  });

  it('the platform-wide cap (cost ceiling) wins over everything', () => {
    expect(limitDecision({ lastMinute: 1, today: 1, platformToday: 1001 }, limits, now)).toMatchObject({ ok: false, reason: 'platform' });
  });

  it('days start at midnight UTC', () => {
    expect(startOfUtcDay(now).toISOString()).toBe('2026-11-27T00:00:00.000Z');
  });
});
