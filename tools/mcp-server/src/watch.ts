#!/usr/bin/env node
/**
 * del-watch-courses: watch the AI video folders for new and changed lessons (owner 2026-11-26, Course Upload and
 * Publishing Agent; .claude/skills/del-course-publisher/SKILL.md, "Monitoring").
 *
 *   DEL_AGENT_TOKEN=… node dist/watch.js [--courses courses] [--env staging|production] [--settle 10] [--interval 15]
 *                                        [--once] [--dry-run] [--agent "<command>"]
 *
 * Every pass, for each courses/<slug>/plan.json:
 * - planned lesson folders whose files changed (size, mtime, sha256 against courses/<slug>/seen.<env>.json) and are
 *   READY are synced with publish() (idempotent: only what is new is uploaded; a failed or interrupted run is retried
 *   on the next pass because `seen` is only updated after a successful sync);
 * - lesson folders that are not in the plan are written to courses/<slug>/inbox.json for the del-course-publisher
 *   agent to review (captions, slides, lab) and place in the plan; `--agent` runs a command once per new batch.
 * READY = no file changed for `--settle` minutes, exactly one video that ffprobe can read, an English caption file,
 * and no PowerPoint without its PDF. PowerPoint is never uploaded (publish() enforces the upload rules).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { open, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative, resolve } from 'node:path';
import { captionText, DEFAULT_INTRO, publish, readManifest, type CoursePlan, type Env, type LessonHint, type LessonRole } from './publish.js';

const VIDEO = new Set(['.mp4', '.m4v', '.mov', '.webm']);
/** Only these files can change what learners get (PowerPoint, thumbnails and production files never are uploaded). */
export const RELEVANT = /\.(mp4|m4v|mov|webm|pdf|zip|srt|vtt)$|(^|\/)lesson\.json$/i;

export interface FileRec { size: number; mtimeMs: number; sha256: string }
export interface Seen { files: Record<string, FileRec>; failed: { at: string; folders: string[]; error: string }[]; lastSyncAt?: string }
export interface Readiness { ready: boolean; reasons: string[]; video?: string; captions?: string; durationSec?: number; newestMtimeMs: number }
export type Probe = (videoPath: string) => number | null;

/** Duration in seconds from ffprobe, or null when the file can't be read (still being written, or broken). */
export const ffprobe: Probe = (p) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], { encoding: 'utf8' });
  const n = Number((r.stdout ?? '').trim());
  return r.status === 0 && Number.isFinite(n) && n > 0 ? n : null;
};

async function walk(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p, base)));
    else if (e.isFile()) out.push(relative(base, p));
  }
  return out.sort();
}

const sha256 = (p: string) => new Promise<string>((ok, fail) => {
  const h = createHash('sha256');
  createReadStream(p).on('data', (d) => h.update(d)).on('error', fail).on('end', () => ok(h.digest('hex')));
});

/** Is a lesson folder complete and finished being written? */
export async function folderReady(folder: string, opts: { settleMinutes: number; now?: number; probe?: Probe }): Promise<Readiness> {
  const now = opts.now ?? Date.now();
  const files = await walk(folder);
  const reasons: string[] = [];
  let newest = 0;
  for (const f of files) newest = Math.max(newest, (await stat(join(folder, f))).mtimeMs);
  const videos = files.filter((f) => !f.includes('/') && VIDEO.has(extname(f).toLowerCase()));
  const caps = files.filter((f) => f.startsWith('captions/') && /\.(srt|vtt)$/i.test(f));
  const en = caps.find((f) => /\.en\.(srt|vtt)$/i.test(f)) ?? (caps.length === 1 ? caps[0] : undefined);
  const top = files.filter((f) => !f.includes('/'));
  const settleMs = opts.settleMinutes * 60_000;
  if (now - newest < settleMs) reasons.push(`files changed ${Math.round((now - newest) / 60_000)} min ago (waiting ${opts.settleMinutes} min to settle)`);
  if (videos.length !== 1) reasons.push(videos.length ? `several videos: ${videos.join(', ')}` : 'no video yet');
  if (!en) reasons.push('no English caption file (captions/*.en.srt)');
  if (top.some((f) => /\.pptx?$/i.test(f)) && !top.some((f) => /\.pdf$/i.test(f))) reasons.push('PowerPoint without its PDF');
  let durationSec: number | undefined;
  if (videos.length === 1 && !reasons.some((r) => r.startsWith('files changed'))) {
    const d = (opts.probe ?? ffprobe)(join(folder, videos[0]!));
    if (d === null) reasons.push('ffprobe cannot read the video (incomplete or broken)');
    else durationSec = Math.round(d);
  }
  return { ready: !reasons.length, reasons, video: videos[0], captions: en, durationSec, newestMtimeMs: newest };
}

/** Files that are new or changed since the last successful sync (sha256 only when size or mtime moved). */
export async function changedFiles(folder: string, key: string, seen: Seen): Promise<{ changed: string[]; recs: Record<string, FileRec> }> {
  const recs: Record<string, FileRec> = {};
  const changed: string[] = [];
  for (const f of await walk(folder)) {
    const id = `${key}/${f}`;
    const st = await stat(join(folder, f));
    const old = seen.files[id];
    if (old && old.size === st.size && old.mtimeMs === st.mtimeMs) { recs[id] = old; continue; }
    const rec = { size: st.size, mtimeMs: st.mtimeMs, sha256: await sha256(join(folder, f)) };
    recs[id] = rec;
    if ((!old || old.sha256 !== rec.sha256) && RELEVANT.test(f)) changed.push(f);
  }
  for (const id of Object.keys(seen.files)) if (id.startsWith(`${key}/`) && !recs[id] && RELEVANT.test(id)) changed.push(`${id.slice(key.length + 1)} (removed)`);
  return { changed, recs };
}

export interface InboxEntry { folder: string; role?: LessonRole; hint?: LessonHint; detectedAt: string; files: string[]; durationSec?: number; firstLines: string; lastLines: string; status: 'ready' | 'waiting'; reasons: string[] }

export interface PassResult {
  course: string; env: Env;
  synced: string[]; waiting: { folder: string; reasons: string[] }[]; inbox: InboxEntry[]; newInbox: string[];
  publish?: { ok: boolean; courseId?: string; issues?: number; error?: string };
}

/** One pass over every plan. */
export async function watchOnce(opts: { coursesDir: string; env: Env; settleMinutes: number; dryRun?: boolean; agentCmd?: string; probe?: Probe; now?: number; publishImpl?: typeof publish; log?: (m: string) => void }): Promise<PassResult[]> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const results: PassResult[] = [];
  const slugs = (await readdir(opts.coursesDir, { withFileTypes: true })).filter((e) => e.isDirectory() && existsSync(join(opts.coursesDir, e.name, 'plan.json'))).map((e) => e.name).sort();
  for (const slugName of slugs) {
    const dir = join(opts.coursesDir, slugName);
    const planPath = join(dir, 'plan.json');
    const plan = JSON.parse(await readFile(planPath, 'utf8')) as CoursePlan;
    const res: PassResult = { course: slugName, env: opts.env, synced: [], waiting: [], inbox: [], newInbox: [] };
    results.push(res);
    if (!existsSync(plan.sourceDir)) { log(`${slugName}: source folder missing: ${plan.sourceDir}`); continue; }
    const seenPath = join(dir, `seen.${opts.env}.json`);
    const seen: Seen = existsSync(seenPath) ? JSON.parse(await readFile(seenPath, 'utf8')) : { files: {}, failed: [] };
    const planned = new Set(plan.sections.flatMap((s) => s.lessons.map((l) => l.folder)));
    const folders = (await readdir(plan.sourceDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();

    // Planned folders: changed + ready → sync.
    const pendingRecs: Record<string, FileRec> = {};
    for (const f of folders.filter((x) => planned.has(x))) {
      const { changed, recs } = await changedFiles(join(plan.sourceDir, f), f, seen);
      if (!changed.length) continue;
      const r = await folderReady(join(plan.sourceDir, f), { settleMinutes: opts.settleMinutes, now: opts.now, probe: opts.probe });
      if (!r.ready) { res.waiting.push({ folder: f, reasons: r.reasons }); continue; }
      res.synced.push(f);
      Object.assign(pendingRecs, recs);
      log(`${slugName}: ${f} changed (${changed.slice(0, 5).join(', ')}${changed.length > 5 ? '…' : ''})`);
    }
    if (res.synced.length && !opts.dryRun) {
      try {
        const out = await (opts.publishImpl ?? publish)(planPath, { env: opts.env, waitMinutes: 0, log });
        if ('dryRun' in out) throw new Error('unexpected dry run');
        res.publish = { ok: true, courseId: out.courseId, issues: out.issues.length };
        Object.assign(seen.files, pendingRecs);
        seen.lastSyncAt = new Date().toISOString();
      } catch (e) {
        res.publish = { ok: false, error: (e as Error).message };
        seen.failed = [...(seen.failed ?? []), { at: new Date().toISOString(), folders: res.synced, error: (e as Error).message }].slice(-20);
        log(`${slugName}: sync failed, retried next pass: ${(e as Error).message}`);
      }
      await writeFile(seenPath, JSON.stringify(seen, null, 2) + '\n');
    }

    // New folders → inbox for the agent's review.
    const inboxPath = join(dir, 'inbox.json');
    const { manifest } = await readManifest(plan.sourceDir);
    const introRe = new RegExp(plan.intro?.folderPattern ?? DEFAULT_INTRO);
    const prev: InboxEntry[] = existsSync(inboxPath) ? JSON.parse(await readFile(inboxPath, 'utf8')).items ?? [] : [];
    for (const f of folders.filter((x) => !planned.has(x))) {
      const p = join(plan.sourceDir, f);
      const r = await folderReady(p, { settleMinutes: opts.settleMinutes, now: opts.now, probe: opts.probe });
      let firstLines = '', lastLines = '';
      if (r.captions) { const t = captionText(await readFile(join(p, r.captions), 'utf8')); firstLines = t.slice(0, 400); lastLines = t.slice(-400); }
      const hint = manifest.lessons.find((x) => x.folder === f);
      const role: LessonRole | undefined = hint?.role ?? (introRe.test(f) ? 'intro' : undefined);
      const entry: InboxEntry = { folder: f, ...(role ? { role } : {}), ...(hint ? { hint } : {}), detectedAt: prev.find((x) => x.folder === f)?.detectedAt ?? new Date().toISOString(), files: (await walk(p)), durationSec: r.durationSec, firstLines, lastLines, status: r.ready ? 'ready' : 'waiting', reasons: r.reasons };
      res.inbox.push(entry);
      if (r.ready && !prev.some((x) => x.folder === f && x.status === 'ready')) res.newInbox.push(f);
    }
    if (!opts.dryRun) {
      if (res.inbox.length) await writeFile(inboxPath, JSON.stringify({ course: slugName, sourceDir: plan.sourceDir, note: 'New lesson folders not in plan.json yet: review them (captions, slides, lab; the manifest hint is only a hint), insert each at its correct position (an intro goes first in section ' + ((plan.intro?.section ?? 0) + 1) + ' with preview true), then re-run del-publish-course.', items: res.inbox }, null, 2) + '\n');
      else if (existsSync(inboxPath)) await rm(inboxPath);
    }
    if (res.newInbox.length) {
      log(`${slugName}: new lesson folder(s) ready for review: ${res.newInbox.map((f) => (res.inbox.find((i) => i.folder === f)?.role === 'intro' ? `${f} (INTRODUCTION)` : f)).join(', ')} → ${inboxPath}`);
      if (opts.agentCmd && !opts.dryRun) {
        const r = spawnSync(opts.agentCmd, { shell: true, stdio: 'inherit', env: { ...process.env, DEL_INBOX: resolve(inboxPath), DEL_PLAN: resolve(planPath), DEL_ENV: opts.env } });
        if (r.status !== 0) log(`${slugName}: agent command exited with ${r.status}; the inbox stays for the next pass`);
      }
    }
    for (const w of res.waiting) log(`${slugName}: ${w.folder} not ready: ${w.reasons.join('; ')}`);
    if (!res.synced.length && !res.newInbox.length && !res.waiting.length) log(`${slugName}: no changes`);
  }
  return results;
}

/** Only one watcher at a time (a stale lock from a dead process is taken over). */
export async function withLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T | 'locked'> {
  try {
    const h = await open(lockPath, 'wx');
    await h.writeFile(String(process.pid));
    await h.close();
  } catch {
    const pid = Number(await readFile(lockPath, 'utf8').catch(() => '0'));
    let alive = false;
    try { if (pid) { process.kill(pid, 0); alive = true; } } catch (e) { alive = (e as NodeJS.ErrnoException).code === 'EPERM'; }
    if (alive && pid !== process.pid) return 'locked';
    await writeFile(lockPath, String(process.pid));
  }
  try { return await fn(); } finally { await rm(lockPath, { force: true }); }
}

// CLI
if (process.argv[1] && ['watch.js', 'del-watch-courses'].includes(basename(process.argv[1]))) {
  const args = process.argv.slice(2);
  const val = (k: string, d?: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
  const coursesDir = resolve(val('--courses', 'courses')!);
  const env = val('--env', 'staging') as Env;
  const settleMinutes = Number(val('--settle', '10'));
  const interval = Number(val('--interval', '15'));
  const once = args.includes('--once');
  const dryRun = args.includes('--dry-run');
  const agentCmd = val('--agent');
  if (!['staging', 'production'].includes(env) || !existsSync(coursesDir)) { console.error('Usage: del-watch-courses [--courses courses] [--env staging|production] [--settle 10] [--interval 15] [--once] [--dry-run] [--agent "<cmd>"]'); process.exit(2); }
  const pass = () => withLock(join(coursesDir, `.watch.${env}.lock`), () => watchOnce({ coursesDir, env, settleMinutes, dryRun, agentCmd }));
  const run = async () => {
    const r = await pass();
    if (r === 'locked') console.log('Another watcher is running; skipped this pass.');
    else console.log(JSON.stringify(r.map((x) => ({ course: x.course, env: x.env, [dryRun ? 'wouldSync' : 'synced']: x.synced, waiting: x.waiting.map((w) => w.folder), newForReview: x.newInbox, inbox: x.inbox.map((i) => `${i.folder} (${i.status})`), publish: x.publish })), null, 2));
  };
  if (once) run().catch((e) => { console.error((e as Error).message); process.exit(1); });
  else {
    const loop = async () => { try { await run(); } catch (e) { console.error((e as Error).message); } setTimeout(loop, interval * 60_000); };
    void loop();
  }
}
