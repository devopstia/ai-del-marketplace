import { AppError } from '../common/errors';
import { REASON_MAX, RELATED_MAX, validateRelated } from './related-courses.service';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('related courses (owner 2026-11-28)', () => {
  it('keeps the given order, trims reasons and drops duplicates', () => {
    expect(validateRelated(A, [{ courseId: C, reason: '  Go deeper  ' }, { courseId: B }, { courseId: C, reason: 'dup' }])).toEqual([
      { courseId: C, reason: 'Go deeper' },
      { courseId: B, reason: '' },
    ]);
  });

  it('refuses a course recommending itself', () => {
    expect(() => validateRelated(A, [{ courseId: A }])).toThrow(AppError);
  });

  it('caps the list and the reason length', () => {
    const many = Array.from({ length: RELATED_MAX + 1 }, (_, i) => ({ courseId: `${i}`.padStart(8, '0') + '-1111-4111-8111-111111111111' }));
    expect(() => validateRelated(A, many)).toThrow(/At most/);
    expect(() => validateRelated(A, [{ courseId: B, reason: 'x'.repeat(REASON_MAX + 1) }])).toThrow(/under/);
  });

  it('an empty list clears the recommendations', () => {
    expect(validateRelated(A, [])).toEqual([]);
  });
});
