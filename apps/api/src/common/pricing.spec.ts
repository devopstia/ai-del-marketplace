import { z } from 'zod';
import { AppError } from './errors';
import { DEFAULT_COMMISSION_BPS, isValidPrice, PRICE_MAX_CENTS, PRICE_MIN_CENTS, priceCentsSchema } from './pricing';
import { DEFAULT_SETTINGS, SettingsService } from './settings.service';
import { splitAmount } from './util';
import { ZodPipe } from './zod';

describe('pricing rules', () => {
  it.each([
    [0, true],
    [499, true],
    [2999, true],
    [99999, true],
    [1, false],
    [99, false],
    [498, false],
    [100000, false],
    [-100, false],
    [1999.5, false],
  ])('%p cents is valid: %p', (cents, ok) => {
    expect(isValidPrice(cents)).toBe(ok);
  });

  it('limits are $4.99 and $999.99', () => {
    expect([PRICE_MIN_CENTS, PRICE_MAX_CENTS]).toEqual([499, 99999]);
  });

  it('a bad price explains the rule with the field name', () => {
    const pipe = new ZodPipe(z.object({ priceCents: priceCentsSchema }));
    const err = (() => {
      try {
        pipe.transform({ priceCents: 50 });
      } catch (e) {
        return e as AppError;
      }
    })()!;
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('validation_failed');
    expect(err.details).toEqual([{ field: 'priceCents', path: 'priceCents', message: 'Price must be 0 (free) or between $4.99 and $999.99' }]);
    expect(err.message).toBe('Price must be 0 (free) or between $4.99 and $999.99.');
  });

  it('commission defaults to 20% (instructors keep 80%)', async () => {
    expect(DEFAULT_COMMISSION_BPS).toBe(2000);
    expect(DEFAULT_SETTINGS.commission_bps).toBe(2000);
    const settings = new SettingsService({ platformSetting: { findUnique: jest.fn(async () => null) } } as any);
    await expect(settings.commissionBps()).resolves.toBe(2000);
    expect(splitAmount(2999, 2000)).toEqual({ commissionCents: 600, instructorShareCents: 2399 });
  });
});

describe('validation messages are plain English with field names', () => {
  const schema = z.object({
    title: z.string().trim().min(3).max(10),
    email: z.string().email(),
    level: z.enum(['beginner', 'advanced']),
    categoryId: z.string().uuid(),
    questions: z.array(z.object({ options: z.array(z.string()).min(3) })),
  });
  const details = (v: unknown) => {
    try {
      new ZodPipe(schema).transform(v);
    } catch (e) {
      return (e as AppError).details as { field: string; message: string }[];
    }
    return [];
  };

  it('maps each issue to { field, message }', () => {
    const d = details({ title: 'ab', email: 'nope', level: 'x', categoryId: '1', questions: [{ options: ['a'] }] });
    expect(d.map((x) => [x.field, x.message])).toEqual([
      ['title', 'Title must be at least 3 characters'],
      ['email', 'Email must be a valid email address'],
      ['level', 'Level must be one of: beginner, advanced'],
      ['categoryId', 'Category must be a valid id'],
      ['questions.0.options', 'Question 1: options needs at least 3 items'],
    ]);
  });

  it('missing and too long values', () => {
    const d = details({ title: 'much too long title', email: 'a@b.co', level: 'beginner', categoryId: '00000000-0000-4000-8000-000000000000' });
    expect(d.map((x) => x.message)).toEqual(['Title must be at most 10 characters', 'Questions is required']);
  });
});
