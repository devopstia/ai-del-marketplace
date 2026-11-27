import { attemptItems, draw, questionId, questionSchema, quizProblems, recommendedRange, signDraw, verifyDraw } from './quiz-model';

describe('quiz model (owner 2026-11-28)', () => {
  const q = (text: string, extra: object = {}) => ({ q: text, options: ['a', 'b', 'c'], correct: 1, why: 'because', ...extra });

  it('stable ids: the author id, or a hash of the text that ignores case and spacing', () => {
    expect(questionId({ id: 'k8s-1', q: 'x' })).toBe('k8s-1');
    expect(questionId({ q: 'What is  State?' })).toBe(questionId({ q: 'what is state?' }));
    expect(questionId({ q: 'A?' })).not.toBe(questionId({ q: 'B?' }));
  });

  it('owner\'s table of question counts by duration', () => {
    expect(recommendedRange(4 * 60)).toEqual([3, 5]);
    expect(recommendedRange(15 * 60)).toEqual([8, 12]);
    expect(recommendedRange(50 * 60)).toEqual([20, 25]);
    expect(recommendedRange(90 * 60)).toEqual([25, 30]);
  });

  it('schema: old questions valid; new optional fields; 2–6 options; unknown fields refused', () => {
    expect(questionSchema.safeParse(q('Old style?')).success).toBe(true);
    expect(questionSchema.safeParse(q('New?', { explanations: ['x', 'y', 'z'], takeaway: 't', difficulty: 'advanced', type: 'troubleshooting', topic: 'State', timestamp: 90, code: 'terraform plan', fixedOrder: true })).success).toBe(true);
    expect(questionSchema.safeParse({ ...q('One option?'), options: ['a'] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...q('Seven?'), options: ['1', '2', '3', '4', '5', '6', '7'] }).success).toBe(false);
    expect(questionSchema.safeParse(q('Extra?', { answer: 'b' })).success).toBe(false);
  });

  it('problems: answer index, explanation count, duplicates, sample size', () => {
    expect(quizProblems([q('A?')])).toEqual([]);
    expect(quizProblems([q('A?', { correct: 3 })])[0]!.field).toBe('questions.0.correct');
    expect(quizProblems([q('A?', { explanations: ['x'] })])[0]!.field).toBe('questions.0.explanations');
    expect(quizProblems([q('A?'), q('a? ')]).map((p) => p.field)).toContain('questions.1.q');
    expect(quizProblems([q('A?', { options: ['x', 'x', 'y'] })])[0]!.field).toBe('questions.0.options');
    expect(quizProblems([q('A?')], { sampleSize: 3 })[0]!.field).toBe('settings.sampleSize');
    expect(quizProblems([q('A?')], { sampleSize: 3, pool: 'course' })).toEqual([]);
  });

  it('draw: everything, or a random sample without repeats', () => {
    const pool = Array.from({ length: 20 }, (_, i) => i);
    expect(draw(pool)).toEqual(pool);
    const s = draw(pool, 7);
    expect(s).toHaveLength(7);
    expect(new Set(s).size).toBe(7);
  });

  it('signed draws: only the same user and quiz verify, and tampering fails', () => {
    const t = signDraw('secret-secret-secret', 'u1', 'q1', ['a', 'b']);
    expect(verifyDraw('secret-secret-secret', 'u1', 'q1', t)).toEqual(['a', 'b']);
    expect(verifyDraw('secret-secret-secret', 'u2', 'q1', t)).toBeNull();
    expect(verifyDraw('secret-secret-secret', 'u1', 'q2', t)).toBeNull();
    const forged = `${Buffer.from(JSON.stringify(['a'])).toString('base64url')}.${t.split('.')[1]}`;
    expect(verifyDraw('secret-secret-secret', 'u1', 'q1', forged)).toBeNull();
    expect(verifyDraw('secret-secret-secret', 'u1', 'q1', 'garbage')).toBeNull();
  });

  it('attempt answers: old arrays map to ids by position; new attempts are by id', () => {
    const qs = [q('A?'), q('B?', { id: 'b' })];
    expect(attemptItems([1, 0], qs)).toEqual([{ id: questionId(qs[0]!), chosen: 1, correct: true }, { id: 'b', chosen: 0, correct: false }]);
    expect(attemptItems({ v: 2, mode: 'full', items: [{ id: 'b', chosen: 1, correct: true }] }, qs)).toEqual([{ id: 'b', chosen: 1, correct: true }]);
    expect(attemptItems(null, qs)).toEqual([]);
  });
});
