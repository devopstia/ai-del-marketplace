import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { toVtt } from './client.js';
import { publish, arrangeCurriculum, assertEnvAllowed, captionText, discover, forEnv, manifestNotes, parseQuiz, readManifest, slug, validatePlan } from './publish.js';

test('upload rules: one video, PDF not PowerPoint, lab ZIP, captions; secrets and thumbnails skipped', async () => {
  const d = await mkdtemp(join(tmpdir(), 'lesson-'));
  for (const f of ['01-x.mp4', '01-x-presentation.pdf', '01-x-presentation.pptx', '01-x-lab.zip', '01-x-thumbnail.png', '.env', 'id_rsa']) await writeFile(join(d, f), 'x');
  await mkdir(join(d, 'captions'));
  await writeFile(join(d, 'captions', '01-x.en.srt'), '1\n00:00:01,000 --> 00:00:02,500\nHi\n');
  const f = await discover(d);
  assert.equal(f.problems.length, 0);
  assert.ok(f.video?.endsWith('01-x.mp4'));
  assert.ok(f.slides?.endsWith('.pdf'));
  assert.ok(f.lab?.endsWith('-lab.zip'));
  assert.ok(f.captions?.endsWith('.en.srt'));
  const skipped = Object.fromEntries(f.skipped.map((s) => [s.file, s.why]));
  assert.match(skipped['01-x-presentation.pptx']!, /PowerPoint/);
  assert.match(skipped['id_rsa']!, /secret/);
  assert.ok(!('.env' in skipped) || /secret/.test(skipped['.env']!));
});

test('PowerPoint without a PDF is a problem to fix, not something to upload', async () => {
  const d = await mkdtemp(join(tmpdir(), 'lesson-'));
  await writeFile(join(d, 'a.mp4'), 'x');
  await writeFile(join(d, 'a.pptx'), 'x');
  const f = await discover(d);
  assert.match(f.problems.join(' '), /convert it to PDF/);
  assert.equal(f.slides, undefined);
});

test('SRT becomes WebVTT; learner-facing names are clean', () => {
  assert.equal(toVtt('﻿1\r\n00:00:01,000 --> 00:00:02,500\r\nHi\r\n'), 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.500\nHi\n');
  assert.equal(toVtt('WEBVTT\n\nx'), 'WEBVTT\n\nx\n');
  assert.equal(slug('Errors, retries and debugging'), 'errors-retries-and-debugging');
});

// Real caption lines from 18-automation-n8n (06, 13 and 01), cut across cues as in the SRT files.
const SRT_06 = `48
00:08:45,700 --> 00:08:49,010
Question 1 of 4. Your pipeline gets 404: not registered for POST requests. What do you change? A: The Webhook node's HTTP method to POST; B: The Mattermost channel; or C: The n8n password?

49
00:08:49,010 --> 00:08:52,000
Pause the video if you need more time, and choose your answer.

50
00:08:52,000 --> 00:08:58,000
The answer is A: The Webhook node's HTTP method to POST. The Webhook node waits for GET by default; pipelines send their data with POST.

51
00:09:00,000 --> 00:09:05,000
Question 2 of 4. Which address should a real CI pipeline call? A: The test URL, /webhook-test/…; B: Mattermost's address; or C: The production URL, /webhook/…, once published? Pause the video if you need more time, and choose your answer. The answer is C: The production URL, /webhook/…, once published. The test URL only works while someone clicks Listen; the production one works all the time.

52
00:09:05,000 --> 00:09:09,000
Let's recap. A webhook is push.
`;

test('quiz from captions: options, answer and explanation; the recap is not part of the last answer', () => {
  const r = parseQuiz(captionText(SRT_06));
  assert.equal(r.questions.length, 2);
  assert.deepEqual(r.questions[0], {
    q: 'Your pipeline gets 404: not registered for POST requests. What do you change?',
    options: ["The Webhook node's HTTP method to POST", 'The Mattermost channel', 'The n8n password'],
    correct: 0,
    why: 'The Webhook node waits for GET by default; pipelines send their data with POST.',
  });
  assert.equal(r.questions[1]!.correct, 2);
  assert.equal(r.questions[1]!.options[2], 'The production URL, /webhook/…, once published');
  assert.equal(r.questions[1]!.why, 'The test URL only works while someone clicks Listen; the production one works all the time.');
});

test('quiz: options said in words, then in symbols, use the last set', () => {
  const t = 'Question 1 of 4. Your report must run at eight a.m., Monday to Friday. Which cron expression? A: zero, eight, star, star, one to five; B: eight, zero, star, star, star; or C: star, eight, star, star, one to five? A: 0 8 * * 1-5; B: 8 0 * * *; or C: * 8 * * 1-5? Pause the video if you need more time, and choose your answer. The answer is A: 0 8 * * 1-5. Minute 0, hour 8, any day of the month, any month, weekdays 1 to 5.';
  const r = parseQuiz(t);
  assert.deepEqual(r.questions[0]!.options, ['0 8 * * 1-5', '8 0 * * *', '* 8 * * 1-5']);
  assert.equal(r.questions[0]!.q, 'Your report must run at eight a.m., Monday to Friday. Which cron expression?');
});

test('quiz: "Pause and think" questions without spoken options are skipped, never invented', () => {
  const t = 'Question 1 of 4. A workflow must check a website every minute. What starts it? Pause and think. The answer is A: A Schedule trigger. A trigger is the event that starts a workflow; a schedule fires on a timer. To remember: n8n runs workflows.';
  const r = parseQuiz(t);
  assert.equal(r.questions.length, 0);
  assert.match(r.skipped[0]!, /not read aloud/);
});

test('environment profiles: production overrides the API and the price; unknown profiles fail', async () => {
  const plan = { environment: 'staging', apiUrl: 'https://s/api', environments: { staging: { apiUrl: 'https://s/api', priceCents: 1500 }, production: { apiUrl: 'https://p/api', priceCents: 100 } }, provider: 'x', instructorName: 'x', sourceDir: '/x', course: { title: 't', priceCents: 1 }, sections: [] } as const;
  const p = forEnv(plan as never, 'production');
  assert.equal(p.apiUrl, 'https://p/api');
  assert.equal(p.course.priceCents, 100);
  assert.equal(p.environment, 'production');
  assert.equal(forEnv(plan as never).course.priceCents, 1500);
  assert.throws(() => forEnv({ ...plan, environments: undefined } as never, 'production'), /no "production" profile/);
  const d = await mkdtemp(join(tmpdir(), 'cfg-'));
  await writeFile(join(d, 'c.json'), '{"productionAllowed": false}');
  await assert.rejects(assertEnvAllowed('production', join(d, 'c.json')), /not allowed/);
  await writeFile(join(d, 'c.json'), '{"productionAllowed": true}');
  await assertEnvAllowed('production', join(d, 'c.json'));
  await assertEnvAllowed('staging', join(d, 'missing.json'));
});

const basePlan = (sections: { title: string; lessons: { folder: string; title: string; preview?: boolean; role?: 'intro' }[] }[]) =>
  ({ environment: 'staging', apiUrl: 'x', provider: 'x', instructorName: 'x', sourceDir: '/none', course: { title: 'Course' }, sections }) as never;

test('re-arranging keeps every existing lesson id; a new lesson is inserted where the plan puts it', () => {
  const state = { sections: { S1: 's1', S2: 's2' }, lessons: { '01-a': 'L1', '02-b': 'L2', '03-new': 'L9', '04-c': 'L3' }, quizzes: { '01-a': 'Q1' } };
  const site = [
    { id: 's1', title: 'S1', lectures: [{ id: 'L1', title: 'A' }, { id: 'Q1', title: 'Quiz A' }, { id: 'L2', title: 'B' }, { id: 'L9', title: 'New' }] },
    { id: 's2', title: 'S2', lectures: [{ id: 'L3', title: 'C' }, { id: 'X', title: 'Made by hand' }] },
  ];
  const plan = basePlan([{ title: 'S1', lessons: [{ folder: '01-a', title: 'A' }, { folder: '03-new', title: 'New' }, { folder: '02-b', title: 'B' }] }, { title: 'S2', lessons: [{ folder: '04-c', title: 'C' }] }]);
  const { arranged, issues } = arrangeCurriculum(plan, state, new Set(['01-a']), site);
  assert.deepEqual(arranged, [{ id: 's1', lectureIds: ['L1', 'Q1', 'L9', 'L2'] }, { id: 's2', lectureIds: ['L3', 'X'] }]);
  const before = new Set(site.flatMap((s) => s.lectures.map((l) => l.id)));
  assert.deepEqual(new Set(arranged.flatMap((a) => a.lectureIds)), before, 'same ids: nothing deleted or recreated');
  assert.match(issues.join(), /Made by hand/);
});

test('plan checks: API limits, the introduction goes first with a preview, duplicate folders', () => {
  const ok = validatePlan(basePlan([{ title: 'S1', lessons: [{ folder: '01-a', title: 'A', preview: true }, { folder: '02-b', title: 'B', preview: true }] }]));
  assert.deepEqual(ok, { errors: [], warnings: [] });
  const bad = validatePlan(basePlan([{ title: 'S1', lessons: [{ folder: '01-a', title: 'A', preview: true }, { folder: '00-intro', title: 'Intro' }, { folder: '01-a', title: 'x'.repeat(201) }] }]));
  assert.match(bad.errors.join('|'), /00-intro is the course introduction: put it first in section 1/);
  assert.match(bad.errors.join('|'), /01-a is in the plan twice/);
  assert.match(bad.errors.join('|'), /01-a title is 201 characters/);
  assert.match(bad.warnings.join('|'), /introduction should be a free preview/);
  const intro = validatePlan(basePlan([{ title: 'S1', lessons: [{ folder: 'welcome', title: 'Welcome', role: 'intro', preview: true }, { folder: '01-a', title: 'A', preview: true }, { folder: '02-b', title: 'B', preview: true }] }]));
  assert.deepEqual(intro, { errors: [], warnings: [] });
});

test('manifest: course.manifest.json plus lesson.json are hints; disagreements are reported, broken files never trusted', async () => {
  const d = await mkdtemp(join(tmpdir(), 'course-'));
  await mkdir(join(d, '01-a'));
  await mkdir(join(d, '00-intro'));
  await mkdir(join(d, '02-b'));
  await writeFile(join(d, 'course.manifest.json'), JSON.stringify({ course: { title: 'C' }, lessons: [{ folder: '01-a', title: 'A better title', role: 'lesson' }] }));
  await writeFile(join(d, '00-intro', 'lesson.json'), JSON.stringify({ title: 'Welcome', role: 'intro' }));
  await writeFile(join(d, '02-b', 'lesson.json'), '{ broken');
  const { manifest, problems } = await readManifest(d);
  assert.equal(manifest.lessons.length, 2);
  assert.match(problems.join(), /02-b\/lesson.json/);
  const notes = manifestNotes(basePlan([{ title: 'S1', lessons: [{ folder: '01-a', title: 'A' }] }]), manifest);
  assert.match(notes.join('|'), /01-a suggests the title "A better title"/);
  assert.match(notes.join('|'), /00-intro is not in the plan \(role intro\)/);
});

test('a manifest quiz fills in questions whose options are only on the slides, when the video says the same answers', async () => {
  const d = await mkdtemp(join(tmpdir(), 'course-'));
  const l = join(d, '01-a');
  await mkdir(join(l, 'captions'), { recursive: true });
  await writeFile(join(l, '01-a.mp4'), 'v');
  await writeFile(join(l, 'captions', '01-a.en.srt'), '1\n00:00:01,000 --> 00:00:09,000\nQuestion 1 of 1. What starts a workflow? Pause and think. The answer is A: A trigger. A trigger is the first node.\n');
  const quiz = [{ q: 'What starts a workflow?', options: ['A trigger', 'The last node', 'Executions'], correct: 0, why: 'A trigger is the first node.' }];
  await writeFile(join(l, 'lesson.json'), JSON.stringify({ quiz }));
  const planPath = join(d, 'plan.json');
  await writeFile(planPath, JSON.stringify({ environment: 'staging', apiUrl: 'x', provider: 'x', instructorName: 'x', sourceDir: d, course: { title: 'Course', quizzes: 'from-captions' }, sections: [{ title: 'S', lessons: [{ folder: '01-a', title: 'A', preview: true }, ] }] }));
  const r = await publish(planPath, { dryRun: true, log: () => {} }) as { quizzes: Record<string, number> };
  assert.equal(r.quizzes['01-a'], 1);
  await writeFile(join(l, 'lesson.json'), JSON.stringify({ quiz: [{ ...quiz[0], correct: 1 }] }));
  const r2 = await publish(planPath, { dryRun: true, log: () => {} }) as { quizzes: Record<string, number>; quizSkips: string[] };
  assert.equal(r2.quizzes['01-a'], 0);
  assert.match(r2.quizSkips.join(), /does not match/);
});
