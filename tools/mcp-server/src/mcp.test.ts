import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DelClient, type Fetch } from './client.js';
import { registerTools } from './tools.js';

const TOKEN = `del_agent_${'t'.repeat(43)}`;

/** A fake agent API + storage, recording every call. Parts are 64 bytes so a 150-byte file has 3. */
function fakeApi(opts: { alreadyUploaded?: number[]; duplicate?: boolean; failPutsOnce?: boolean; scopeError?: boolean } = {}) {
  const calls: { method: string; url: string; auth?: string; body?: unknown }[] = [];
  const puts: number[] = [];
  let failed = false;
  const parts = new Map<number, number>((opts.alreadyUploaded ?? []).map((n) => [n, n < 3 ? 64 : 22]));
  const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const f: Fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ method, url, auth: headers.Authorization, body: init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined });
    if (url.startsWith('https://storage.test/')) {
      const n = Number(new URL(url).searchParams.get('n'));
      if (opts.failPutsOnce && !failed) { failed = true; return new Response('', { status: 503 }); }
      const size = (init!.body as Uint8Array).byteLength;
      puts.push(n); parts.set(n, size);
      return new Response('', { status: 200, headers: { ETag: `"e${n}"` } });
    }
    const path = url.replace('https://del.test/api/agent', '');
    if (opts.scopeError) return json(403, { error: { code: 'agent_scope', message: 'This agent token does not have the “courses:write” scope.' } });
    if (path === '/whoami') return json(200, { instructor: { id: 'i1', name: 'Nadia Rahman' } });
    if (path === '/uploads' && method === 'POST') {
      if (opts.duplicate) return json(200, { duplicate: true, id: 'u0', kind: 'video', assetId: 'a-old', status: 'ready' });
      return json(200, { id: 'u1', kind: 'video', partSize: 64, partCount: 3, status: 'uploading', assetId: 'a1', resume: !!opts.alreadyUploaded?.length });
    }
    if (path.startsWith('/uploads/u1/parts')) {
      return json(200, { uploaded: [...parts].map(([partNumber, size]) => ({ partNumber, size })), urls: [1, 2, 3].map((n) => ({ partNumber: n, size: n < 3 ? 64 : 22, url: `https://storage.test/put?n=${n}` })) });
    }
    if (path === '/uploads/u1/complete') {
      const total = [...parts.values()].reduce((a, b) => a + b, 0);
      if (total !== 150) return json(400, { error: { code: 'upload_incomplete', message: `Uploaded ${total} bytes, expected 150` } });
      return json(200, { id: 'u1', kind: 'video', status: 'completed', assetId: 'a1', video: { id: 'a1', status: 'processing' } });
    }
    return json(404, { error: { code: 'not_found', message: 'Not found' } });
  };
  return { f, calls, puts };
}

async function shared() {
  const root = await mkdtemp(join(tmpdir(), 'del-mcp-'));
  await mkdir(join(root, 'videos'));
  await writeFile(join(root, 'videos', '02-pods.mp4'), Buffer.alloc(150, 7));
  await writeFile(join(root, 'videos', '01-intro.mp4'), Buffer.alloc(10, 1));
  await writeFile(join(root, 'slides.pdf'), 'pdf');
  return root;
}

async function connect(del: DelClient) {
  const server = new McpServer({ name: 'del-courses', version: 'test' });
  registerTools(server, del);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
const text = (r: unknown) => ((r as { content: { text: string }[] }).content[0]!.text);

test('exposes the course tools and calls the API with the agent token only', async () => {
  const api = fakeApi();
  const client = await connect(new DelClient('https://del.test/api', TOKEN, [], api.f));
  const tools = (await client.listTools()).tools.map((t) => t.name);
  for (const n of ['create_course', 'add_section', 'add_lesson', 'upload_file', 'upload_files', 'attach_file', 'validate_course', 'preview_course', 'submit_for_review', 'set_cover']) assert.ok(tools.includes(n), n);
  assert.ok(!tools.some((n) => /publish|delete|payment/.test(n)), 'no publish/delete/payment tools');
  const r = await client.callTool({ name: 'whoami', arguments: {} });
  assert.match(text(r), /Nadia Rahman/);
  assert.equal(api.calls[0]!.auth, `Bearer ${TOKEN}`);
});

test('resumes an upload: only the missing parts are sent, then completed', async () => {
  const root = await shared();
  const api = fakeApi({ alreadyUploaded: [1] });
  const del = new DelClient('https://del.test/api', TOKEN, [root], api.f, 1);
  const res = await del.upload(join(root, 'videos', '02-pods.mp4'));
  assert.deepEqual(api.puts, [2, 3]);
  assert.equal(res.partsUploaded, 2);
  assert.equal(res.resumed, true);
  assert.equal(res.assetId, 'a1');
  assert.equal(res.status, 'processing');
  const start = api.calls.find((c) => c.url.endsWith('/uploads'))!.body as { sha256: string; sizeBytes: number; kind: string };
  assert.match(start.sha256, /^[a-f0-9]{64}$/);
  assert.equal(start.sizeBytes, 150);
  assert.equal(start.kind, 'video');
});

test('retries a failed part and reuses a duplicate without uploading', async () => {
  const root = await shared();
  const flaky = fakeApi({ failPutsOnce: true });
  const res = await new DelClient('https://del.test/api', TOKEN, [root], flaky.f, 1).upload(join(root, 'videos', '02-pods.mp4'));
  assert.deepEqual(flaky.puts, [1, 2, 3]);
  assert.equal(res.status, 'processing');
  const dup = fakeApi({ duplicate: true });
  const d = await new DelClient('https://del.test/api', TOKEN, [root], dup.f, 1).upload(join(root, 'videos', '02-pods.mp4'));
  assert.equal(d.duplicate, true);
  assert.equal(d.assetId, 'a-old');
  assert.deepEqual(dup.puts, []);
});

test('only reads the shared folders', async () => {
  const root = await shared();
  const other = await mkdtemp(join(tmpdir(), 'del-private-'));
  await writeFile(join(other, 'secret.mp4'), 'x');
  const api = fakeApi();
  const del = new DelClient('https://del.test/api', TOKEN, [root], api.f, 1);
  await assert.rejects(del.upload(join(other, 'secret.mp4')), /outside the folders shared/);
  await assert.rejects(del.upload(join(root, '..', 'x.mp4')), /ENOENT|outside/);
  const files = await del.listFiles();
  assert.deepEqual(files.map((f) => f.relative), ['slides.pdf', join('videos', '01-intro.mp4'), join('videos', '02-pods.mp4')]);
  assert.equal(files.find((f) => f.relative.endsWith('02-pods.mp4'))!.video, true);
  assert.equal(api.calls.length, 0);
});

test('reports API refusals as tool errors with the reason', async () => {
  const api = fakeApi({ scopeError: true });
  const client = await connect(new DelClient('https://del.test/api', TOKEN, [], api.f));
  const r = await client.callTool({ name: 'create_course', arguments: { title: 'Kubernetes basics' } });
  assert.equal((r as { isError?: boolean }).isError, true);
  assert.match(text(r), /agent_scope \(403\)/);
});

test('upload_files keeps going after one failure', async () => {
  const root = await shared();
  const api = fakeApi();
  const client = await connect(new DelClient('https://del.test/api', TOKEN, [root], api.f, 1));
  const r = await client.callTool({ name: 'upload_files', arguments: { paths: [join(root, 'nope.mp4'), join(root, 'videos', '02-pods.mp4')] } });
  const out = JSON.parse(text(r)) as { uploaded: number; failed: number };
  assert.equal(out.uploaded, 1);
  assert.equal(out.failed, 1);
});

test('refuses a non-agent token or URL', () => {
  assert.throws(() => new DelClient('https://del.test/api', 'sid-cookie-value', []), /agent token/);
  assert.throws(() => new DelClient('del.test', TOKEN, []), /http/);
});
