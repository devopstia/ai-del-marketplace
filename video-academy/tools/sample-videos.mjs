#!/usr/bin/env node
// Placeholder help videos (owner 2026-11-25: "Put dummy videos in Help videos and we will add the right videos later").
// For every entry in the plan: a 24-second DEL-styled sample (title, topic, "Sample video" label), a cover, captions and
// two chapters, published to the LOCAL site. Running `node tools/publish-help.mjs --publish` for a real video later
// replaces the sample with the same address.
//   node tools/sample-videos.mjs [--draft]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const adapter = await import("../brands/del/brand.mjs");
const { PLAN } = await import("../brands/del/plan.mjs");
const publish = !process.argv.includes("--draft");
const OUT = path.join(ROOT, ".work", "samples");
fs.mkdirSync(OUT, { recursive: true });
const FONT = path.join(adapter.REPO, "apps/api/assets/fonts/SchibstedGrotesk-700.ttf");
const C = adapter.brand.colors;
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/'/g, "\u2019").replace(/:/g, "\\:").replace(/%/g, "\\%");
const cat = (k) => adapter.categories.find(([c]) => c === k)?.[1] ?? k;
const wrap = (s, n) => { const w = s.split(" "); const lines = [""]; for (const x of w) { if ((lines.at(-1) + " " + x).trim().length > n) lines.push(x); else lines[lines.length - 1] = (lines.at(-1) + " " + x).trim(); } return lines; };

function make(p) {
  const mp4 = path.join(OUT, `${p.id}.mp4`), png = path.join(OUT, `${p.id}.png`), srt = path.join(OUT, `${p.id}.srt`);
  const lines = wrap(p.short, 26);
  const text = (w, h, scale) => [
    `drawtext=fontfile=${FONT}:text='${esc(cat(p.category).toUpperCase())}':fontcolor=${C.primary}:fontsize=${26 * scale}:x=${110 * scale}:y=${h / 2 - (60 + lines.length * 50) * scale}`,
    ...lines.map((l, i) => `drawtext=fontfile=${FONT}:text='${esc(l)}':fontcolor=${C.ink}:fontsize=${78 * scale}:x=${110 * scale}:y=${h / 2 - (lines.length * 50 - i * 96 - 10) * scale}`),
    `drawtext=fontfile=${FONT}:text='SAMPLE VIDEO · THE REAL ONE IS COMING SOON':fontcolor=${C.muted}:fontsize=${22 * scale}:x=${110 * scale}:y=${h - 150 * scale}`,
    `drawtext=fontfile=${FONT}:text='DevOps Easy Learning':fontcolor=${C.body}:fontsize=${24 * scale}:x=${110 * scale}:y=${h - 100 * scale}`,
    `drawbox=x=${110 * scale}:y=${h - 200 * scale}:w=${120 * scale}:h=${6 * scale}:color=${C.primary}:t=fill`,
  ].join(",");
  // Video: a slow progress bar shows it is playing; quiet tone so audio controls can be tried.
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=${C.bg}:s=1920x1080:r=30:d=24`, "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=48000:duration=24",
    "-filter_complex", `[0:v]${text(1920, 1080, 1)},drawbox=x=0:y=1074:w='iw*t/24':h=6:color=${C.primary2}:t=fill,format=yuv420p[v];[1:a]volume=0.04[a]`,
    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", mp4]);
  // Cover: big type so it reads at thumbnail size (the help list shows covers about 190 px wide).
  const big = wrap(p.short, 16);
  const cover = [
    `drawtext=fontfile=${FONT}:text='${esc(cat(p.category).toUpperCase())}':fontcolor=${C.primary}:fontsize=40:x=80:y=${360 - big.length * 62 - 70}`,
    ...big.map((l, i) => `drawtext=fontfile=${FONT}:text='${esc(l)}':fontcolor=${C.ink}:fontsize=112:x=80:y=${360 - big.length * 62 + i * 124}`),
    `drawbox=x=80:y=${360 + big.length * 62 + 30}:w=140:h=10:color=${C.primary}:t=fill`,
  ].join(",");
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=${C.surface}:s=1280x720:d=1`, "-vf", cover, "-frames:v", "1", "-quality", "86", png.replace(/\.png$/, ".webp")]);
  fs.writeFileSync(srt, `1\n00:00:01,000 --> 00:00:11,000\nThis is a sample. The help video "${p.short}" is coming soon.\n\n2\n00:00:12,000 --> 00:00:23,000\n${p.description}\n`);
  return { mp4, cover: png.replace(/\.png$/, ".webp"), srt };
}

const srtToVtt = (s) => "WEBVTT\n\n" + s.replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, "$1.$2").trim() + "\n";
const { request } = await import(path.join(adapter.REPO, "node_modules/playwright/index.mjs"));
const rq = await request.newContext();
let csrf = (await (await rq.get(`${adapter.app.api}/auth/csrf`)).json()).csrf;
async function call(method, p, data) {
  const r = await rq.fetch(`${adapter.app.api}${p}`, { method, data, headers: { "X-CSRF-Token": csrf } });
  if (!r.ok()) throw new Error(`${method} ${p}: ${r.status()} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
const put = async (url, body, headers) => { const r = await rq.fetch(url, { method: "PUT", data: body, headers }); if (!r.ok()) throw new Error(`upload failed: ${r.status()}`); };
await call("POST", "/auth/login", { email: adapter.accounts.admin.email, password: adapter.borrowAccounts().password });
csrf = (await (await rq.get(`${adapter.app.api}/auth/csrf`)).json()).csrf;

for (const p of PLAN) {
  const f = make(p);
  const up = await call("POST", "/admin/help/uploads/video", { filename: `${p.id}-sample.mp4`, contentType: "video/mp4" });
  await put(up.uploadUrl, fs.readFileSync(f.mp4), up.headers);
  const c = await call("POST", `/admin/help/uploads/video/${up.assetId}/captions`);
  await put(c.uploadUrl, Buffer.from(srtToVtt(fs.readFileSync(f.srt, "utf8"))), c.headers);
  await call("POST", `/admin/help/uploads/video/${up.assetId}/complete`);
  const im = await call("POST", "/admin/help/uploads/image", { contentType: "image/webp" });
  await put(im.uploadUrl, fs.readFileSync(f.cover), im.headers);
  for (let i = 0; i < 60; i++) { const a = await call("GET", `/admin/help/uploads/video/${up.assetId}`); if (a.status === "ready") break; if (a.status === "failed") throw new Error(`${p.id}: processing failed`); await new Promise((r) => setTimeout(r, 1500)); }
  await call("PUT", `/admin/help/videos/${p.id}`, { title: p.title, summary: p.description, audience: p.audience, category: p.category, sort: p.order, videoAssetId: up.assetId, coverKey: im.key, chapters: [{ t: 0, title: "Introduction" }, { t: 12, title: "What you'll learn" }], published: publish });
  console.log(`${p.id}: sample ${publish ? "published" : "saved as a draft"}`);
}
await rq.dispose();
