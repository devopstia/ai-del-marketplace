import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lectureTitle, levelOf, parsePlan, parseQuiz, stableId } from './import-del';
import { srtToVtt } from './srt';
import { defaultExportString, firstArgOfCall, parseLiteralAt, ParseError } from './js-literal';

describe('safe literal parser', () => {
  it('reads strings, numbers, arrays, objects, comments and trailing commas', () => {
    const src = `[ { q: "Say \\"hi\\"", 'k': 'v', n: -1.5e2, ok: true, none: null, t: \`multi
line\`, }, /* c */ [1, 2,], // end
]`;
    expect(parseLiteralAt(src, 0).value).toEqual([{ q: 'Say "hi"', k: 'v', n: -150, ok: true, none: null, t: 'multi\nline' }, [1, 2]]);
  });

  it.each([
    ['identifier', '[foo]'],
    ['member access', '{ a: RT.purple }'],
    ['function', '{ a: () => 1 }'],
    ['template interpolation', '`x${y}`'],
    ['spread', '[...xs]'],
    ['shorthand', '{ a }'],
    ['__proto__', '{ __proto__: {} }'],
  ])('refuses %s (never evaluates code)', (_l, src) => {
    expect(() => parseLiteralAt(src, 0)).toThrow(ParseError);
  });

  it('finds quizSet([...]) but ignores the import line and comments', () => {
    const src = `import { quizSet } from "./pack.mjs";\n// quizSet([oops])\nconst quiz = quizSet([{ q: "Q", options: ["a","b","c"], correct: 2, why: "w" }], { num: "05" });`;
    expect(firstArgOfCall(src, 'quizSet')).toEqual([{ q: 'Q', options: ['a', 'b', 'c'], correct: 2, why: 'w' }]);
  });

  it('reads a string property of the default export without parsing the rest', () => {
    const src = `const x = 1;\nexport default {\n  id: "a", scenes: [s1, ...quiz],\n  subtitle: "Hello, world.",\n};`;
    expect(defaultExportString(src, 'subtitle')).toBe('Hello, world.');
  });
});

describe('DEL import helpers', () => {
  it('plan entries come from E(...) calls', () => {
    const src = `const E = (a) => a;\nexport const PLAN = [\n  // comment\n  E("cloud-ai", 4, "x-id", "Title", "Short", "Intermediate", "f", "s", "d", { extra: 1 }),\n];`;
    expect(parsePlan(src)).toEqual([{ category: 'cloud-ai', order: 4, id: 'x-id', title: 'Title', short: 'Short', audience: 'Intermediate' }]);
  });

  it('quiz items are validated (3–5 options, correct in range)', () => {
    const src = `quizSet([{ q: "ok", options: ["a","b","c"], correct: 0, why: "w", say: "spoken" }, { q: "bad", options: ["a","b"], correct: 0, why: "w" }, { q: "bad2", options: ["a","b","c"], correct: 3, why: "w" }])`;
    expect(parseQuiz(src)).toEqual([{ q: 'ok', options: ['a', 'b', 'c'], correct: 0, why: 'w' }]);
    expect(parseQuiz('no quiz here')).toBeNull();
  });

  it('levels, titles and stable ids', () => {
    expect(levelOf(['Beginners', 'Beginners, no IT background'])).toBe('beginner');
    expect(levelOf(['Beginners', 'Intermediate'])).toBe('intermediate');
    expect(lectureTitle('AI terminology: the big words (AI)')).toBe('The big words (AI)');
    expect(stableId('lecture:a')).toBe(stableId('lecture:a'));
    expect(stableId('lecture:a')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

});

describe('captions', () => {
  it('SRT becomes WebVTT', () => {
    const vtt = srtToVtt('\uFEFF1\r\n00:00:00,700 --> 00:00:05,390\r\nHello there.\r\n\r\n2\r\n00:00:05,940 --> 00:00:19,530\r\nLine one\r\nLine two\r\n');
    expect(vtt).toBe('WEBVTT\n\n1\n00:00:00.700 --> 00:00:05.390\nHello there.\n\n2\n00:00:05.940 --> 00:00:19.530\nLine one\nLine two\n');
  });
});

// When the real (read-only) DEL sources are on this machine, check every tutorial parses.
const ROOT = process.env.DEL_SOURCE_DIR ?? join(__dirname, '..', '..', '..', '..', '..', 'ai-videos', 'projects', 'ai-devops');
const real = existsSync(join(ROOT, 'branding', 'plan.mjs')) ? describe : describe.skip;
real('real DEL sources (read-only)', () => {
  it('plan.mjs parses and every tutorial quiz has 3–5 valid questions', () => {
    const plan = parsePlan(readFileSync(join(ROOT, 'branding', 'plan.mjs'), 'utf8'));
    expect(plan.length).toBeGreaterThan(30);
    const files = readdirSync(join(ROOT, 'tutorials')).filter((f) => f.endsWith('.mjs') && !f.startsWith('_'));
    let quizzes = 0;
    for (const f of files) {
      const src = readFileSync(join(ROOT, 'tutorials', f), 'utf8');
      const q = parseQuiz(src);
      if (src.includes('quizSet([')) {
        expect({ f, n: q?.length }).toEqual({ f, n: expect.any(Number) });
        expect(q!.length).toBeGreaterThanOrEqual(3);
        quizzes++;
      }
    }
    expect(quizzes).toBeGreaterThan(20);
  });
});
