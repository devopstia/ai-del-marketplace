import assert from 'node:assert/strict';
import { mkdtemp, mkdir, utimes, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { changedFiles, folderReady, watchOnce, withLock, type Seen } from './watch.js';

const SRT = '1\n00:00:01,000 --> 00:00:02,000\nHello, this lesson shows a VM.\n';
const old = (p: string) => utimes(p, new Date(Date.now() - 3600_000), new Date(Date.now() - 3600_000));
async function lesson(root: string, name: string, opts: { pptxOnly?: boolean; fresh?: boolean; noCaps?: boolean } = {}) {
  const d = join(root, name);
  await mkdir(join(d, 'captions'), { recursive: true });
  const files = [`${name}.mp4`, opts.pptxOnly ? `${name}-presentation.pptx` : `${name}-presentation.pdf`, `${name}-lab.zip`];
  for (const f of files) await writeFile(join(d, f), f);
  if (!opts.noCaps) await writeFile(join(d, 'captions', `${name}.en.srt`), SRT);
  if (!opts.fresh) for (const f of [...files, ...(opts.noCaps ? [] : [`captions/${name}.en.srt`])]) await old(join(d, f));
  return d;
}
const probe = () => 60;

test('ready only when settled, one readable video, English captions, and a PDF next to PowerPoint', async () => {
  const root = await mkdtemp(join(tmpdir(), 'watch-'));
  assert.equal((await folderReady(await lesson(root, '01-a'), { settleMinutes: 10, probe })).ready, true);
  const fresh = await folderReady(await lesson(root, '02-b', { fresh: true }), { settleMinutes: 10, probe });
  assert.equal(fresh.ready, false);
  assert.match(fresh.reasons.join(), /settle/);
  assert.match((await folderReady(await lesson(root, '03-c', { pptxOnly: true }), { settleMinutes: 10, probe })).reasons.join(), /PowerPoint without its PDF/);
  assert.match((await folderReady(await lesson(root, '04-d', { noCaps: true }), { settleMinutes: 10, probe })).reasons.join(), /English caption/);
  assert.match((await folderReady(await lesson(root, '05-e'), { settleMinutes: 10, probe: () => null })).reasons.join(), /ffprobe/);
});

test('changed files: new, modified (by checksum) and removed; untouched files are not re-hashed as changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'watch-'));
  const d = await lesson(root, '01-a');
  const seen: Seen = { files: {}, failed: [] };
  const first = await changedFiles(d, '01-a', seen);
  assert.equal(first.changed.length, 4);
  await writeFile(join(d, 'notes.pptx'), 'pp');
  assert.ok(!(await changedFiles(d, '01-a', { files: first.recs, failed: [] })).changed.includes('notes.pptx'), 'PowerPoint changes never trigger an upload');
  seen.files = first.recs;
  assert.equal((await changedFiles(d, '01-a', seen)).changed.length, 0);
  await writeFile(join(d, '01-a-lab.zip'), 'new lab');
  assert.deepEqual((await changedFiles(d, '01-a', seen)).changed, ['01-a-lab.zip']);
});

test('a pass syncs changed planned lessons once, puts new folders in the inbox, and retries after a failure', async () => {
  const src = await mkdtemp(join(tmpdir(), 'videos-'));
  const courses = await mkdtemp(join(tmpdir(), 'courses-'));
  await lesson(src, '01-a');
  await lesson(src, '02-new');
  await lesson(src, '03-wip', { fresh: true });
  await mkdir(join(courses, 'c1'));
  await writeFile(join(courses, 'c1', 'plan.json'), JSON.stringify({ environment: 'staging', apiUrl: 'x', provider: 'x', instructorName: 'x', sourceDir: src, course: { title: 't' }, sections: [{ title: 's', lessons: [{ folder: '01-a', title: 'A' }] }] }));
  let calls = 0;
  let fail = true;
  const publishImpl = (async () => { calls++; if (fail) throw new Error('network down'); return { courseId: 'c', counts: {}, issues: [], validation: {}, studioUrl: '', reportPath: '' }; }) as never;
  const opts = { coursesDir: courses, env: 'staging' as const, settleMinutes: 10, probe, publishImpl, log: () => {} };

  let [r] = await watchOnce(opts);
  assert.deepEqual(r!.synced, ['01-a']);
  assert.equal(r!.publish?.ok, false);
  assert.deepEqual(r!.newInbox, ['02-new']);
  assert.deepEqual(r!.inbox.map((i) => `${i.folder}:${i.status}`), ['02-new:ready', '03-wip:waiting']);
  const inbox = JSON.parse(readFileSync(join(courses, 'c1', 'inbox.json'), 'utf8'));
  assert.match(inbox.items[0].firstLines, /this lesson shows a VM/);

  fail = false;
  [r] = await watchOnce(opts); // retried, because the failed sync didn't mark the files as seen
  assert.equal(r!.publish?.ok, true);
  assert.deepEqual(r!.newInbox, [], 'the same folder is not announced twice');
  [r] = await watchOnce(opts);
  assert.deepEqual(r!.synced, []);
  assert.equal(calls, 2);
  assert.ok(existsSync(join(courses, 'c1', 'seen.staging.json')));

  const dry = await watchOnce({ ...opts, dryRun: true });
  assert.equal(dry[0]!.publish, undefined);
});

test('only one watcher runs at a time', async () => {
  const d = await mkdtemp(join(tmpdir(), 'lock-'));
  const lock = join(d, '.lock');
  const inner = await withLock(lock, async () => withLock(lock, async () => 'second'));
  assert.equal(inner, 'second', 'same process may re-enter');
  await writeFile(lock, '1'); // pid 1 is alive
  assert.equal(await withLock(lock, async () => 'ran'), 'locked');
  await writeFile(lock, '999999'); // dead pid: stale lock taken over
  assert.equal(await withLock(lock, async () => 'ran'), 'ran');
});

test('an intro folder (00-… or role "intro" in lesson.json) is flagged as the introduction in the inbox', async () => {
  const src = await mkdtemp(join(tmpdir(), 'videos-'));
  const courses = await mkdtemp(join(tmpdir(), 'courses-'));
  await lesson(src, '00-welcome');
  await lesson(src, 'zz-start');
  await writeFile(join(src, 'zz-start', 'lesson.json'), JSON.stringify({ role: 'intro', title: 'Start here' }));
  await old(join(src, 'zz-start', 'lesson.json'));
  await mkdir(join(courses, 'c1'));
  await writeFile(join(courses, 'c1', 'plan.json'), JSON.stringify({ environment: 'staging', apiUrl: 'x', provider: 'x', instructorName: 'x', sourceDir: src, course: { title: 't' }, sections: [] }));
  const [r] = await watchOnce({ coursesDir: courses, env: 'staging', settleMinutes: 10, probe, dryRun: true, log: () => {} });
  assert.deepEqual(r!.inbox.map((i) => [i.folder, i.role, i.hint?.title]), [['00-welcome', 'intro', undefined], ['zz-start', 'intro', 'Start here']]);
});
