import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ApiError, parseCookieJar, SESSION_ENDED, SessionClient, sessionValidation, studioRoute, type FileRecord } from './client.js';
import { stateFileStore } from './publish.js';

const JAR = [
  '# Netscape HTTP Cookie File',
  '#HttpOnly_example.com\tFALSE\t/\tTRUE\t0\tsid\tsess-123',
  'example.com\tFALSE\t/\tTRUE\t0\tcsrf\tcsrf-abc',
  '',
].join('\n');

test('session mode: cookie jar (HttpOnly lines included)', () => {
  assert.deepEqual(parseCookieJar(JAR), { sid: 'sess-123', csrf: 'csrf-abc' });
});

test('session mode: every agent path the publisher uses maps to a DEL Studio route', () => {
  const c = 'c1', l = 'l1', s = 's1', v = 'v1';
  const cases: [string, string, string | null][] = [
    ['GET', '/whoami', null],
    ['GET', '/categories', '/categories'],
    ['GET', '/courses', '/instructor/courses'],
    ['POST', '/courses', '/instructor/courses'],
    ['GET', `/courses/${c}`, `/instructor/courses/${c}`],
    ['PATCH', `/courses/${c}`, `/instructor/courses/${c}`],
    ['POST', `/courses/${c}/sections`, `/instructor/courses/${c}/sections`],
    ['PATCH', `/courses/${c}/sections/${s}`, `/instructor/courses/${c}/sections/${s}`],
    ['POST', `/courses/${c}/sections/${s}/lectures`, `/instructor/courses/${c}/sections/${s}/lectures`],
    ['PATCH', `/courses/${c}/lectures/${l}`, `/instructor/courses/${c}/lectures/${l}`],
    ['PUT', `/courses/${c}/curriculum`, `/instructor/courses/${c}/curriculum`],
    ['PUT', `/courses/${c}/lectures/${l}/quiz`, `/instructor/courses/${c}/lectures/${l}/quiz`],
    ['POST', `/courses/${c}/lectures/${l}/resources`, `/instructor/courses/${c}/lectures/${l}/resources`],
    ['GET', `/courses/${c}/covers`, `/instructor/courses/${c}/cover`],
    ['PUT', `/courses/${c}/cover`, `/instructor/courses/${c}/cover`],
    ['POST', `/courses/${c}/submit`, `/instructor/courses/${c}/submit`],
    ['GET', `/courses/${c}/validation`, null],
    ['GET', `/courses/${c}/preview`, null],
    ['GET', '/videos', '/instructor/videos'],
    ['GET', `/videos/${v}`, `/instructor/videos/${v}`],
    ['POST', `/videos/${v}/captions`, `/instructor/uploads/video/${v}/captions`],
  ];
  for (const [m, p, want] of cases) assert.equal(studioRoute(m, p)?.path ?? null, want, `${m} ${p}`);
  assert.throws(() => studioRoute('POST', '/uploads'), /upload\(\)/);
  assert.throws(() => studioRoute('GET', '/admin/anything'), /No studio route/);
});

/** A tiny fake API + storage that records what was called. */
function fakeServer(opts: { actingAs?: { id: string; name: string } | null; status401?: boolean } = {}) {
  const calls: string[] = [];
  let n = 0;
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${u.replace('https://x.test/api', '')}`);
    const headers = new Headers(init?.headers as HeadersInit);
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
    if (u.startsWith('https://s3.test/')) return new Response('', { status: 200 });
    assert.match(headers.get('cookie') ?? '', /sid=sess-123/);
    assert.match(headers.get('cookie') ?? '', /act_as=platform/);
    assert.equal(headers.get('x-csrf-token'), 'csrf-abc');
    if (opts.status401) return json({ error: { code: 'unauthorized', message: 'Sign in' } }, 401);
    if (u.endsWith('/auth/session/heartbeat')) return json({ kind: 'user' });
    if (u.endsWith('/auth/me')) return json({ user: { name: 'Owner', roles: ['super_admin'], actingAs: opts.actingAs === undefined ? { id: 'del', name: 'DevOps Easy Learning' } : opts.actingAs } });
    if (u.endsWith('/instructor/uploads/video')) return json({ assetId: `asset-${++n}`, uploadUrl: 'https://s3.test/v', method: 'PUT', headers: { 'Content-Type': 'video/mp4' } });
    if (/\/instructor\/uploads\/video\/[^/]+\/complete$/.test(u)) return json({ id: 'x', status: 'processing' });
    if (u.endsWith('/instructor/uploads/resource')) return json({ storageKey: `instructors/del/r-${++n}.pdf`, uploadUrl: 'https://s3.test/r', method: 'PUT', headers: { 'Content-Type': 'application/pdf' } });
    if (u.includes('/instructor/courses/c1') && method === 'GET') return json({ id: 'c1', status: 'draft', coverTemplateId: null, sections: [{ title: 'S', lectures: [{ id: 'l', title: 'L', type: 'video', videoAssetId: null, video: null }] }] });
    return json({});
  }) as typeof fetch;
  return { calls, fetchImpl };
}

async function folder() {
  const d = await mkdtemp(join(tmpdir(), 'sess-'));
  await writeFile(join(d, 'a.mp4'), 'video-1');
  await writeFile(join(d, 'a.pdf'), 'pdf-1');
  return d;
}

test('session mode: uploads go through the studio flow and are de-duplicated by checksum in the state file', async () => {
  const d = await folder();
  const state: { files?: Record<string, FileRecord> } = {};
  let saves = 0;
  const store = stateFileStore(state, async () => { saves++; });
  const { calls, fetchImpl } = fakeServer();
  const cl = new SessionClient('https://x.test/api', JAR, [d], store, fetchImpl, 1, 0);

  const v1 = await cl.upload(join(d, 'a.mp4'), { courseId: 'c1', name: 'lesson.mp4' });
  assert.equal(v1.duplicate, false);
  assert.equal(v1.assetId, 'asset-1');
  assert.ok(calls.includes('POST /instructor/uploads/video') && calls.includes('PUT https://s3.test/v') && calls.includes('POST /instructor/uploads/video/asset-1/complete'));
  const r1 = await cl.upload(join(d, 'a.pdf'), { courseId: 'c1', name: 'lesson-slides.pdf' });
  assert.match(r1.storageKey!, /r-2\.pdf$/);
  assert.equal(Object.keys(state.files!).length, 2);
  assert.ok(saves >= 2);

  const before = calls.length;
  const v2 = await cl.upload(join(d, 'a.mp4'), { courseId: 'c1', existingAssetId: 'asset-1' });
  const r2 = await cl.upload(join(d, 'a.pdf'), { courseId: 'c1' });
  assert.equal(v2.duplicate, true);
  assert.equal(v2.assetId, 'asset-1');
  assert.equal(r2.storageKey, r1.storageKey);
  assert.equal(calls.length, before, 'a re-run sends nothing');

  // The video changed: the attached asset is known under the old checksum, so the new file is uploaded.
  await writeFile(join(d, 'a.mp4'), 'video-2');
  const v3 = await cl.upload(join(d, 'a.mp4'), { courseId: 'c1', existingAssetId: 'asset-1' });
  assert.equal(v3.duplicate, false);
  assert.notEqual(v3.assetId, 'asset-1');
  cl.close();
});

test('session mode: a lesson video the state never saw (state lost, or made in the studio) is adopted, not uploaded again', async () => {
  const d = await folder();
  const state: { files?: Record<string, FileRecord> } = {};
  const { calls, fetchImpl } = fakeServer();
  const cl = new SessionClient('https://x.test/api', JAR, [d], stateFileStore(state, async () => undefined), fetchImpl, 1, 0);
  const v = await cl.upload(join(d, 'a.mp4'), { courseId: 'c1', existingAssetId: 'studio-asset' });
  assert.equal(v.duplicate, true);
  assert.equal(v.assetId, 'studio-asset');
  assert.ok(!calls.some((c) => c.includes('/uploads/video')));
  assert.equal(Object.values(state.files!)[0]!.assetId, 'studio-asset');
});

test('session mode: whoami is DEL Studio; refuses without act-as; a 401 stops with "sign in again"', async () => {
  const d = await folder();
  const store = stateFileStore({}, async () => undefined);
  const ok = new SessionClient('https://x.test/api', JAR, [d], store, fakeServer().fetchImpl, 1, 0);
  assert.deepEqual((await ok.call<{ instructor: unknown }>('GET', '/whoami')).instructor, { id: 'del', name: 'DevOps Easy Learning' });
  assert.match((await ok.call<{ studioUrl: string }>('GET', '/courses/c1/preview')).studioUrl, /^https:\/\/x\.test\/studio\/courses\/c1$/);
  const v = await ok.call<{ ok: boolean; errors: string[] }>('GET', '/courses/c1/validation');
  assert.equal(v.ok, false);
  assert.match(v.errors[0]!, /has no video/);

  const noAct = new SessionClient('https://x.test/api', JAR, [d], store, fakeServer({ actingAs: null }).fetchImpl, 1, 0);
  await assert.rejects(noAct.call('GET', '/whoami'), /not working as DEL's platform account/);

  const ended = new SessionClient('https://x.test/api', JAR, [d], store, fakeServer({ status401: true }).fetchImpl, 1, 0);
  await assert.rejects(ended.call('GET', '/courses'), (e: unknown) => e instanceof ApiError && e.code === 'session_ended' && e.message === SESSION_ENDED);
  assert.throws(() => new SessionClient('https://x.test/api', '# empty\n', [d], store), /no session/);
});

test('session mode: report validation from the course itself', () => {
  const v = sessionValidation({ id: 'c', status: 'draft', coverTemplateId: 't', sections: [{ title: 'S', lectures: [
    { id: '1', title: 'Ready', type: 'video', videoAssetId: 'a', video: { id: 'a', status: 'ready' } },
    { id: '2', title: 'Busy', type: 'video', videoAssetId: 'b', video: { id: 'b', status: 'processing' } },
    { id: '3', title: 'Quiz', type: 'quiz', videoAssetId: null, video: null, quiz: { questions: [] } },
  ] }] });
  assert.equal(v.ok, false);
  assert.deepEqual(v.errors, ['quiz "Quiz" has no questions']);
  assert.deepEqual(v.warnings, ['"Busy": video still processing']);
});
