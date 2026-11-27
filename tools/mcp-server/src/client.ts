import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, readdir, readFile, realpath, stat } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';

/**
 * Thin client for the DevOps Easy Learning agent API (/api/agent/*, docs/SUPPORT_SESSIONS_AND_AGENTS.md).
 * The token is scoped to one instructor by a super admin; this client never sees a password or a cookie.
 */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) {
    super(message);
  }
}

export type Fetch = typeof fetch;

const TYPES: Record<string, string> = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.pdf': 'application/pdf', '.zip': 'application/zip', '.md': 'text/markdown', '.txt': 'text/plain',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.yaml': 'application/yaml', '.yml': 'application/yaml', '.json': 'application/json', '.sh': 'text/x-shellscript',
  '.py': 'text/x-python', '.tf': 'text/plain', '.js': 'text/javascript', '.ts': 'text/plain', '.csv': 'text/csv',
  '.vtt': 'text/vtt', '.srt': 'text/plain',
};
export const contentTypeOf = (file: string) => TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
export const isVideo = (file: string) => contentTypeOf(file).startsWith('video/');

/** SRT → WebVTT (timestamps use "." and the file starts with WEBVTT); WebVTT is returned unchanged. */
export function toVtt(text: string): string {
  const t = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (t.startsWith('WEBVTT')) return t + '\n';
  const body = t.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${body}\n`;
}

export interface UploadProgress { file: string; partNumber: number; partCount: number }
export interface UploadResult { file: string; kind: 'video' | 'resource'; duplicate: boolean; resumed: boolean; assetId?: string; storageKey?: string; status?: string; partsUploaded: number }

export class DelClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    /** Folders the instructor made available; nothing outside them is read. */
    private readonly roots: string[],
    private readonly fetchImpl: Fetch = fetch,
    private readonly retryDelayMs = 1000,
  ) {
    if (!/^https?:\/\//.test(baseUrl)) throw new Error('DEL_API_URL must be an http(s) URL ending in /api');
    if (!token.startsWith('del_agent_')) throw new Error('DEL_AGENT_TOKEN must be an agent token (del_agent_…)');
  }

  async call<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/agent${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (!res.ok) {
      const err = (data.error ?? data) as { code?: string; message?: string; details?: unknown };
      throw new ApiError(res.status, err.code ?? `http_${res.status}`, err.message ?? res.statusText, err.details);
    }
    return data as T;
  }

  // ---------- files the instructor provided ----------

  /** Resolves a path and refuses anything outside the allowed folders (symlinks included). */
  async allowed(path: string): Promise<string> {
    if (!this.roots.length) throw new Error('No folders are shared with this agent (set DEL_UPLOAD_ROOTS).');
    const real = await realpath(resolve(path));
    for (const root of this.roots) {
      const r = await realpath(resolve(root));
      if (real === r || real.startsWith(r + sep)) return real;
    }
    throw new Error(`${path} is outside the folders shared for this task`);
  }

  /** Files under the shared folders (or one of them), with size and type: what the agent may upload. */
  async listFiles(dir?: string, maxFiles = 2000) {
    const out: { path: string; relative: string; sizeBytes: number; contentType: string; video: boolean }[] = [];
    const starts = dir ? [await this.allowed(dir)] : await Promise.all(this.roots.map((r) => this.allowed(r)));
    const walk = async (d: string, base: string) => {
      for (const e of (await readdir(d, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
        if (out.length >= maxFiles || e.name.startsWith('.')) continue;
        const p = join(d, e.name);
        if (e.isDirectory()) await walk(p, base);
        else if (e.isFile()) {
          const s = await stat(p);
          out.push({ path: p, relative: relative(base, p), sizeBytes: s.size, contentType: contentTypeOf(p), video: isVideo(p) });
        }
      }
    };
    for (const s of starts) await walk(s, s);
    return out;
  }

  async sha256(path: string): Promise<string> {
    const h = createHash('sha256');
    await new Promise<void>((ok, fail) => createReadStream(path).on('data', (c) => h.update(c)).on('end', () => ok()).on('error', fail));
    return h.digest('hex');
  }

  /**
   * Upload one file through resumable multipart: checksum (duplicate detection), start or resume, PUT the missing
   * parts with retries, complete. Never reports success unless the server confirms completion.
   */
  async upload(path: string, opts: { courseId?: string; onProgress?: (p: UploadProgress) => void; /** Name learners see when they download it (default: the file's own name). */ name?: string; /** Session mode only; the agent API de-duplicates by checksum on the server. */ existingAssetId?: string | null } = {}): Promise<UploadResult> {
    const file = await this.allowed(path);
    const size = (await stat(file)).size;
    if (!size) throw new Error(`${path} is empty`);
    const kind = isVideo(file) ? 'video' : 'resource';
    const sha256 = await this.sha256(file);
    const started = await this.call<Record<string, unknown>>('POST', '/uploads', { kind, filename: opts.name ?? file.split(sep).pop(), contentType: contentTypeOf(file), sizeBytes: size, sha256, courseId: opts.courseId });
    if (started.duplicate) return { file, kind, duplicate: true, resumed: false, assetId: started.assetId as string | undefined, storageKey: started.storageKey as string | undefined, status: started.status as string | undefined, partsUploaded: 0 };
    const id = String(started.id);
    const partCount = Number(started.partCount);
    const partSize = Number(started.partSize);
    let uploaded = 0;
    const fh = await open(file, 'r');
    try {
      for (let from = 1; from <= partCount; from += 20) {
        const batch = await this.call<{ uploaded: { partNumber: number; size: number }[]; urls: { partNumber: number; url: string; size: number }[] }>('GET', `/uploads/${id}/parts?from=${from}&count=20`);
        const done = new Set(batch.uploaded.filter((p) => p.size > 0).map((p) => p.partNumber));
        for (const part of batch.urls) {
          if (done.has(part.partNumber)) continue;
          const buf = Buffer.alloc(part.size);
          await fh.read(buf, 0, part.size, (part.partNumber - 1) * partSize);
          await this.putWithRetry(part.url, buf);
          uploaded++;
          opts.onProgress?.({ file, partNumber: part.partNumber, partCount });
        }
      }
    } finally {
      await fh.close();
    }
    const done = await this.call<Record<string, unknown>>('POST', `/uploads/${id}/complete`);
    const video = done.video as { status?: string } | undefined;
    return { file, kind, duplicate: false, resumed: !!started.resume, assetId: done.assetId as string | undefined, storageKey: done.storageKey as string | undefined, status: video?.status ?? String(done.status), partsUploaded: uploaded };
  }

  /**
   * Captions for an uploaded video: SRT or WebVTT from the shared folders, sent as WebVTT. Learners only see them when
   * they turn captions on (CC); they also power search inside videos.
   */
  async uploadCaptions(assetId: string, path: string): Promise<{ assetId: string; bytes: number }> {
    const file = await this.allowed(path);
    const vtt = toVtt(await readFile(file, 'utf8'));
    const put = await this.call<{ uploadUrl: string; headers: Record<string, string> }>('POST', `/videos/${assetId}/captions`);
    const r = await this.fetchImpl(put.uploadUrl, { method: 'PUT', headers: put.headers, body: vtt });
    if (!r.ok) throw new Error(`Captions upload failed: storage answered ${r.status}`);
    return { assetId, bytes: Buffer.byteLength(vtt) };
  }

  private async putWithRetry(url: string, body: Buffer, attempts = 4) {
    for (let i = 1; ; i++) {
      try {
        const r = await this.fetchImpl(url, { method: 'PUT', body: new Uint8Array(body) });
        if (r.ok) return;
        throw new Error(`storage answered ${r.status}`);
      } catch (e) {
        if (i >= attempts) throw new Error(`Part upload failed after ${attempts} attempts: ${(e as Error).message}`);
        await new Promise((ok) => setTimeout(ok, this.retryDelayMs * 2 ** (i - 1)));
      }
    }
  }
}

// ---------- session mode (owner 2026-11-27: "Please do not use agents") ----------

/** Same surface as DelClient as far as the publisher uses it; lets publish() run with either. */
export interface PublisherClient {
  call<T = unknown>(method: string, path: string, body?: unknown): Promise<T>;
  upload(path: string, opts?: { courseId?: string; name?: string; existingAssetId?: string | null }): Promise<UploadResult>;
  uploadCaptions(assetId: string, path: string): Promise<{ assetId: string; bytes: number }>;
  close?(): void;
}

/** What session mode remembers about files it uploaded (the studio API has no checksum de-duplication). */
export interface FileRecord { kind: 'video' | 'resource'; assetId?: string; storageKey?: string; name: string; at: string }
export interface FileStore { get(sha: string): FileRecord | undefined; set(sha: string, r: FileRecord): Promise<void> | void; knowsAsset(assetId: string): boolean }

export const SESSION_ENDED = 'Your sign-in ended. Sign in again with `! scripts/del-signin.sh`, then re-run: nothing is lost, the run resumes.';

/** Cookies from a curl (Netscape) cookie jar, including `#HttpOnly_` lines. */
export function parseCookieJar(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.startsWith('#HttpOnly_') ? raw.slice('#HttpOnly_'.length) : raw;
    if (!line.trim() || line.startsWith('#')) continue;
    const f = line.split('\t');
    if (f.length >= 7) out[f[5]!] = f[6]!;
  }
  return out;
}

/**
 * Agent-API path (what publish() speaks) → DEL Studio route. Studio routes run as DEL's platform account because the
 * super admin's request carries `act_as=platform` (common/acting.ts). `null` = handled in the client.
 */
export function studioRoute(method: string, agentPath: string): { method: string; path: string } | null {
  const p = agentPath.split('?')[0]!;
  const m = method.toUpperCase();
  if (p === '/whoami' || /^\/courses\/[^/]+\/(validation|preview)$/.test(p)) return null;
  if (p === '/categories') return { method: m, path: '/categories' };
  if (/^\/courses\/[^/]+\/covers$/.test(p)) return { method: m, path: `/instructor${p.replace(/covers$/, 'cover')}` };
  const cap = p.match(/^\/videos\/([^/]+)\/captions$/);
  if (cap) return { method: m, path: `/instructor/uploads/video/${cap[1]}/captions` };
  if (/^\/(courses|videos)(\/|$)/.test(p)) return { method: m, path: `/instructor${agentPath}` };
  if (p.startsWith('/uploads')) throw new Error('Session mode uploads through upload(), not /uploads');
  throw new Error(`No studio route for ${m} ${agentPath}`);
}

interface StudioLecture { id: string; title: string; type?: string; videoAssetId: string | null; video: { id: string; status: string } | null; quiz?: { questions: unknown[] } | null }
interface StudioCourse { id: string; status: string; coverTemplateId: string | null; sections: { title: string; lectures: StudioLecture[] }[] }

/** The checks the agent API's validation makes that the publisher can see from the course itself (report only). */
export function sessionValidation(c: StudioCourse) {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const s of c.sections) {
    if (!s.lectures.length) warnings.push(`section "${s.title}" has no lessons`);
    for (const l of s.lectures) {
      if ((l.type ?? 'video') === 'video') {
        if (!l.videoAssetId) errors.push(`"${l.title}" has no video`);
        else if (l.video?.status === 'failed') errors.push(`"${l.title}": video failed processing`);
        else if (l.video && l.video.status !== 'ready') warnings.push(`"${l.title}": video still ${l.video.status}`);
      }
      if (l.type === 'quiz' && !l.quiz?.questions?.length) errors.push(`quiz "${l.title}" has no questions`);
    }
  }
  if (!c.coverTemplateId) warnings.push('no cover chosen');
  return { ok: !errors.length, errors, warnings, source: 'session mode: checked by the publisher from the course (the server-side validation is agent-API only)' };
}

/**
 * DEL Studio client for session mode: the owner signs in (scripts/del-signin.sh: password + authenticator code, nothing
 * stored but the cookie jar) and the publisher works as DEL's platform account through `act_as=platform`.
 * Keeps the session alive with the heartbeat; a 401 stops the run with SESSION_ENDED.
 */
export class SessionClient implements PublisherClient {
  private readonly cookies: Record<string, string>;
  private readonly timer?: ReturnType<typeof setInterval>;
  private lastBeat = 0;

  constructor(
    private readonly baseUrl: string,
    jarText: string,
    private readonly roots: string[],
    private readonly files: FileStore,
    private readonly fetchImpl: Fetch = fetch,
    private readonly retryDelayMs = 1000,
    heartbeatMs = 4 * 60_000,
  ) {
    if (!/^https?:\/\//.test(baseUrl)) throw new Error('The API URL must be an http(s) URL ending in /api');
    this.cookies = parseCookieJar(jarText);
    if (!this.cookies.sid) throw new Error('The cookie jar has no session (sid). Sign in with `! scripts/del-signin.sh` first.');
    if (heartbeatMs > 0) {
      this.timer = setInterval(() => void this.heartbeat().catch(() => undefined), heartbeatMs);
      this.timer.unref?.();
    }
  }

  close() { if (this.timer) clearInterval(this.timer); }

  private headers(json: boolean): Record<string, string> {
    const jar = { ...this.cookies, act_as: 'platform' };
    return {
      Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '),
      ...(this.cookies.csrf ? { 'x-csrf-token': this.cookies.csrf } : {}),
      Accept: 'application/json',
      ...(json ? { 'Content-Type': 'application/json' } : {}),
    };
  }

  private async raw<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}${path}`, { method, headers: this.headers(body !== undefined), body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try { data = text ? (JSON.parse(text) as Record<string, unknown>) : {}; } catch { data = { message: text.slice(0, 200) }; }
    if (res.status === 401) throw new ApiError(401, 'session_ended', SESSION_ENDED);
    if (!res.ok) {
      const err = (data.error ?? data) as { code?: string; message?: string; details?: unknown };
      throw new ApiError(res.status, err.code ?? `http_${res.status}`, err.message ?? res.statusText, err.details);
    }
    return data as T;
  }

  async heartbeat() {
    this.lastBeat = Date.now();
    return this.raw('POST', '/auth/session/heartbeat', {});
  }

  async call<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    if (Date.now() - this.lastBeat > 3 * 60_000) await this.heartbeat();
    if (path === '/whoami') {
      const me = await this.raw<{ user: { name: string; roles: string[]; actingAs: { id: string; name: string } | null } | null }>('GET', '/auth/me');
      if (!me.user) throw new ApiError(401, 'session_ended', SESSION_ENDED);
      if (!me.user.roles.includes('super_admin') || !me.user.actingAs) throw new Error(`Signed in as ${me.user.name}, but not working as DEL's platform account (needs a super admin; act_as=platform). Nothing was changed.`);
      return { instructor: { id: me.user.actingAs.id, name: me.user.actingAs.name }, realUser: me.user.name } as T;
    }
    const v = path.match(/^\/courses\/([^/]+)\/(validation|preview)$/);
    if (v) {
      if (v[2] === 'preview') return { studioUrl: `${this.baseUrl.replace(/\/api\/?$/, '')}/studio/courses/${v[1]}` } as T;
      return sessionValidation(await this.raw<StudioCourse>('GET', `/instructor/courses/${v[1]}`)) as T;
    }
    const r = studioRoute(method, path)!;
    return this.raw<T>(r.method, r.path, body);
  }

  async allowed(path: string): Promise<string> {
    const real = await realpath(resolve(path));
    for (const root of this.roots) {
      const r = await realpath(resolve(root));
      if (real === r || real.startsWith(r + sep)) return real;
    }
    throw new Error(`${path} is outside the course folder`);
  }

  async sha256(path: string): Promise<string> {
    const h = createHash('sha256');
    await new Promise<void>((ok, fail) => createReadStream(path).on('data', (c) => h.update(c)).on('end', () => ok()).on('error', fail));
    return h.digest('hex');
  }

  /**
   * Studio upload (one presigned PUT), idempotent through the file store: a file whose checksum was uploaded before is
   * reused. `existingAssetId`: the video already on the lesson; if the store has never seen that asset (state lost or
   * a lesson made in the studio) it is adopted for this checksum instead of uploading again.
   */
  async upload(path: string, opts: { courseId?: string; name?: string; existingAssetId?: string | null } = {}): Promise<UploadResult> {
    const file = await this.allowed(path);
    const size = (await stat(file)).size;
    if (!size) throw new Error(`${path} is empty`);
    const kind = isVideo(file) ? 'video' : 'resource';
    const sha = await this.sha256(file);
    const name = opts.name ?? file.split(sep).pop()!;
    const known = this.files.get(sha);
    if (known) return { file, kind, duplicate: true, resumed: false, assetId: known.assetId, storageKey: known.storageKey, partsUploaded: 0 };
    if (kind === 'video' && opts.existingAssetId && !this.files.knowsAsset(opts.existingAssetId)) {
      await this.files.set(sha, { kind, assetId: opts.existingAssetId, name, at: new Date().toISOString() });
      return { file, kind, duplicate: true, resumed: false, assetId: opts.existingAssetId, partsUploaded: 0 };
    }
    const contentType = contentTypeOf(file);
    const body = await readFile(file);
    if (kind === 'video') {
      const target = await this.raw<{ assetId: string; uploadUrl: string; headers?: Record<string, string> }>('POST', '/instructor/uploads/video', { filename: name, contentType, ...(opts.courseId ? { courseId: opts.courseId } : {}) });
      await this.putWithRetry(target.uploadUrl, body, target.headers ?? { 'Content-Type': contentType });
      const done = await this.raw<{ id: string; status: string }>('POST', `/instructor/uploads/video/${target.assetId}/complete`, {});
      await this.files.set(sha, { kind, assetId: target.assetId, name, at: new Date().toISOString() });
      return { file, kind, duplicate: false, resumed: false, assetId: target.assetId, status: done.status, partsUploaded: 1 };
    }
    const target = await this.raw<{ storageKey: string; uploadUrl: string; headers?: Record<string, string> }>('POST', '/instructor/uploads/resource', { filename: name, contentType, sizeBytes: size, ...(opts.courseId ? { courseId: opts.courseId } : {}) });
    await this.putWithRetry(target.uploadUrl, body, target.headers ?? { 'Content-Type': contentType });
    await this.files.set(sha, { kind, storageKey: target.storageKey, name, at: new Date().toISOString() });
    return { file, kind, duplicate: false, resumed: false, storageKey: target.storageKey, partsUploaded: 1 };
  }

  async uploadCaptions(assetId: string, path: string): Promise<{ assetId: string; bytes: number }> {
    const file = await this.allowed(path);
    const vtt = toVtt(await readFile(file, 'utf8'));
    const put = await this.call<{ uploadUrl: string; headers: Record<string, string> }>('POST', `/videos/${assetId}/captions`, {});
    const r = await this.fetchImpl(put.uploadUrl, { method: 'PUT', headers: put.headers, body: vtt });
    if (!r.ok) throw new Error(`Captions upload failed: storage answered ${r.status}`);
    return { assetId, bytes: Buffer.byteLength(vtt) };
  }

  private async putWithRetry(url: string, body: Buffer, headers: Record<string, string>, attempts = 4) {
    for (let i = 1; ; i++) {
      try {
        const r = await this.fetchImpl(url, { method: 'PUT', headers, body: new Uint8Array(body) });
        if (r.ok) return;
        throw new Error(`storage answered ${r.status}`);
      } catch (e) {
        if (i >= attempts) throw new Error(`Upload failed after ${attempts} attempts: ${(e as Error).message}`);
        await new Promise((ok) => setTimeout(ok, this.retryDelayMs * 2 ** (i - 1)));
      }
    }
  }
}
