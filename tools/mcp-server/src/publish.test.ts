import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { toVtt } from './client.js';
import { discover, slug } from './publish.js';

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
