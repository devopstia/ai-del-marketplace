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
  async upload(path: string, opts: { courseId?: string; onProgress?: (p: UploadProgress) => void; /** Name learners see when they download it (default: the file's own name). */ name?: string } = {}): Promise<UploadResult> {
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
