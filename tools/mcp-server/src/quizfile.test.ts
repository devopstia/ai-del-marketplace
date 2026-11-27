import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { publish } from './publish.js';
import { assessmentFiles, checkQuizFile, recommendedRange } from './quizfile.js';

const good = (i: number, extra: object = {}) => ({
  id: `q${i}`,
  q: `After terraform apply fails half way, which statement about state is true (case ${i})?`,
  options: ['Nothing was created', 'State records what was created before the error', 'State is deleted', 'Terraform rolls back automatically'],
  correct: 1,
  why: 'Terraform writes state as resources are created, so a partial apply is recorded.',
  explanations: ['Resources created before the error exist.', 'Correct: state tracks them.', 'State is never deleted by a failure.', 'Terraform has no automatic rollback.'],
  takeaway: 'Read the plan again after a failed apply.',
  difficulty: 'applied', type: 'troubleshooting', topic: 'State', timestamp: 120 + i,
  ...extra,
});

test('quiz.json checks: a good bank passes; the count is only a warning; errors are specific', () => {
  const ok = checkQuizFile({ questions: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => good(i)) }, { durationSec: 15 * 60 });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.warnings, []);
  assert.equal(ok.file.questions.length, 8);

  const few = checkQuizFile({ questions: [good(1), good(2)] }, { durationSec: 15 * 60 });
  assert.deepEqual(few.errors, []);
  assert.match(few.warnings[0]!, /2 questions for a 15-minute video \(recommended 8–12/);

  const bad = checkQuizFile({ questions: [
    good(1, { correct: 4 }),
    good(2, { explanations: ['only one'] }),
    good(3, { timestamp: 2000 }),
    good(4, { q: good(5).q }), good(5),
    good(6, { q: 'Which file records what Terraform created: the terraform.tfstate file?', options: ['main.tf', 'the terraform.tfstate file'], correct: 1, explanations: ['a', 'b'] }),
    good(7, { answer: 'x' }),
    good(8, { difficulty: 'expert' }),
    good(9, { id: 'q1' }),
  ] }, { durationSec: 15 * 60 });
  const all = bad.errors.join('\n');
  assert.match(all, /question 1: "correct" must be the index/);
  assert.match(all, /question 2: one explanation per option/);
  assert.match(all, /question 3: timestamp 2000s is after the end of the video \(900s\)/);
  assert.match(all, /question 5: repeats an earlier question/);
  assert.match(all, /question 6: the question gives the answer away/);
  assert.match(all, /question 7: unknown field "answer"/);
  assert.match(all, /question 8: difficulty is one of/);
  assert.match(all, /question 9: id "q1" used twice/);
  assert.match(checkQuizFile({ questions: Array.from({ length: 61 }, (_, i) => good(i)) }).errors[0]!, /at most 60/);
  assert.deepEqual(checkQuizFile({ questions: [] }).errors, ['no questions']);
});

test('assessments: module, final and scenario files; settings checked; size guidance as warnings', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'assess-'));
  for (const n of ['module-2-assessment.json', 'final-assessment.json', 'scenario-broken-pipeline.json', 'notes.md']) await writeFile(join(dir, n), '{}');
  const files = await assessmentFiles(dir);
  assert.deepEqual(files.map((f) => [f.key, f.kind, f.section, f.title]), [
    ['final', 'final', null, 'Final assessment'],
    ['module-2', 'module', 2, 'Module 2 assessment'],
    ['scenario-broken-pipeline', 'scenario', null, 'Scenario: broken pipeline'],
  ]);
  const m = checkQuizFile({ settings: { kind: 'module', pool: 'module', sampleSize: 20 }, questions: [good(1), good(2)] }, { assessment: true });
  assert.deepEqual(m.errors, []);
  assert.deepEqual(m.warnings, []);
  const f = checkQuizFile({ settings: { kind: 'final', sampleSize: 5 }, questions: [good(1), good(2)] }, { assessment: true });
  assert.match(f.errors.join(), /sampleSize 5 is more than the 2 questions/);
  assert.match(f.warnings.join(), /final assessment with 5 questions per attempt \(recommended 30–60\)/);
  assert.match(checkQuizFile({ settings: { kind: 'exam', extra: 1 }, questions: [good(1)] }).errors.join(), /unknown field "extra".*|settings.kind/);
  assert.deepEqual(recommendedRange(25 * 60), [10, 15]);
});

test('publish: quiz.json wins over the captions, assessments close their module, and a changed file replaces the quiz in place', async () => {
  const root = await mkdtemp(join(tmpdir(), 'quizfile-'));
  const src = join(root, 'src');
  await mkdir(join(src, '01-a', 'captions'), { recursive: true });
  await writeFile(join(src, '01-a', '01-a.mp4'), 'video');
  await writeFile(join(src, '01-a', 'captions', '01-a.en.srt'),
    '1\n00:00:01,000 --> 00:00:09,000\nQuestion 1 of 1. What starts a workflow? A: The trigger; B: The last node; or C: The log? Pause the video. The answer is A: The trigger. It is the first node.\n');
  const bank = { questions: [good(1), good(2), good(3)] };
  await writeFile(join(src, '01-a', 'quiz.json'), JSON.stringify(bank));
  await mkdir(join(src, 'assessments'));
  await writeFile(join(src, 'assessments', 'final-assessment.json'), JSON.stringify({ settings: { pool: 'course', sampleSize: 30 }, questions: [good(10), good(11)] }));
  const dir = join(root, 'course');
  await mkdir(dir);
  await writeFile(join(root, 'publisher.config.json'), JSON.stringify({ productionAllowed: true, quizBanks: true }));
  await writeFile(join(dir, 'plan.json'), JSON.stringify({
    environment: 'staging', apiUrl: 'https://x.test/api', provider: 'DEL', instructorName: 'DevOps Easy Learning', sourceDir: src, assessments: 'assessments',
    course: { title: 'Course', quizzes: 'from-captions' },
    sections: [{ title: 'Module 1', lessons: [{ folder: '01-a', title: 'State', short: 'State' }] }],
  }));
  await writeFile(join(dir, 'state.staging.json'), JSON.stringify({ courseId: 'c1', sections: { 'Module 1': 's1' }, lessons: { '01-a': 'l1' }, quizzes: { '01-a': 'q1' } }));

  type L = { id: string; sectionId: string; title: string; summary: string; isPreview: boolean; type: string; videoAssetId: string | null; video: unknown; resources: unknown[]; quiz?: { questions: unknown[] } | null };
  const lectures: L[] = [
    { id: 'l1', sectionId: 's1', title: 'State', summary: '', isPreview: false, type: 'video', videoAssetId: 'v1', video: { id: 'v1', status: 'ready', durationSec: 900, hasCaptions: true }, resources: [] },
    { id: 'q1', sectionId: 's1', title: 'Quiz: State', summary: '', isPreview: false, type: 'quiz', videoAssetId: null, video: null, resources: [], quiz: { questions: [{ q: 'old', options: ['a', 'b', 'c'], correct: 0, why: 'w' }] } },
  ];
  let calls: string[] = [];
  let n = 0;
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const path = String(url).replace('https://x.test/api/agent', '');
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${path}${init?.body ? ' ' + init.body : ''}`);
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (path === '/whoami') return json({ instructor: { id: 'del', name: 'DevOps Easy Learning' } });
    if (path === '/categories') return json({ items: [] });
    if (path === '/courses' && method === 'GET') return json({ items: [{ id: 'c1', title: 'Course' }] });
    if (path === '/courses/c1' && method === 'GET') return json({ id: 'c1', title: 'Course', status: 'draft', coverTemplateId: 't', sections: [{ id: 's1', title: 'Module 1', lectures }] });
    if (path === '/uploads') return json({ duplicate: true, assetId: 'v1', status: 'ready' });
    if (path === '/courses/c1/validation') return json({ ok: true });
    if (path === '/courses/c1/sections/s1/lectures' && method === 'POST') {
      const b = JSON.parse(String(init!.body)) as { title: string };
      const id = `new${++n}`;
      lectures.push({ id, sectionId: 's1', title: b.title, summary: '', isPreview: false, type: 'quiz', videoAssetId: null, video: null, resources: [], quiz: null });
      return json({ id });
    }
    const put = /^\/courses\/c1\/lectures\/([^/]+)\/quiz$/.exec(path);
    if (put && method === 'PUT') { lectures.find((l) => l.id === put[1])!.quiz = { questions: (JSON.parse(String(init!.body)) as { questions: unknown[] }).questions }; return json({}); }
    return json({});
  }) as typeof fetch;
  const run = () => publish(join(dir, 'plan.json'), { token: 'del_agent_test', fetchImpl, waitMinutes: 0, log: () => undefined });

  await run();
  const lessonPut = calls.find((c) => c.startsWith('PUT /courses/c1/lectures/q1/quiz '));
  assert.ok(lessonPut, 'lesson quiz replaced from quiz.json');
  assert.ok(lessonPut!.includes('"explanations"') && lessonPut!.includes('"id":"q1"'), 'the full bank is sent');
  assert.ok(!lessonPut!.includes('What starts a workflow'), 'captions not used when quiz.json exists');
  const made = calls.find((c) => c.startsWith('POST /courses/c1/sections/s1/lectures '));
  assert.ok(made?.includes('"title":"Final assessment"'), 'final assessment created in the last module');
  const finalPut = calls.find((c) => c.startsWith('PUT /courses/c1/lectures/new1/quiz '));
  assert.ok(finalPut?.includes('"kind":"final"') && finalPut.includes('"pool":"course"') && finalPut.includes('"sampleSize":30'), 'assessment settings sent');
  const order = calls.find((c) => c.startsWith('PUT /courses/c1/curriculum '))!;
  assert.ok(order.includes('"lectureIds":["l1","q1","new1"]'), `assessment closes the module: ${order}`);

  // Nothing changed: nothing resent, nothing recreated.
  calls = [];
  await run();
  assert.ok(!calls.some((c) => /^PUT \/courses\/c1\/lectures\/(q1|new1)\/quiz/.test(c)), 'unchanged files are not resent');
  assert.ok(!calls.some((c) => c.startsWith('POST /courses/c1/sections')), 'nothing recreated');

  // A changed quiz.json replaces the lesson's quiz, same quiz lesson.
  await writeFile(join(src, '01-a', 'quiz.json'), JSON.stringify({ questions: [...bank.questions, good(4)] }));
  calls = [];
  await run();
  assert.ok(calls.some((c) => c.startsWith('PUT /courses/c1/lectures/q1/quiz ') && c.includes('"id":"q4"')), 'changed bank replaced in place');
  assert.ok(!calls.some((c) => c.startsWith('POST /courses/c1/sections')), 'same quiz lesson kept');

  // A broken bank stops the upload before anything is sent.
  await writeFile(join(src, '01-a', 'quiz.json'), JSON.stringify({ questions: [good(1, { correct: 9 })] }));
  calls = [];
  await assert.rejects(run(), /quiz\.json: question 1: "correct" must be the index/);
  assert.ok(!calls.some((c) => c.startsWith('PUT ')), 'nothing written');
});
