#!/usr/bin/env node
// Publishes built help videos to DEL's Help videos (Admin > Help videos) on the LOCAL stack through the API.
//   node tools/publish-help.mjs [id...] [--publish] [--dry-run]
// Without ids: every built video in brands/<brand>/status.json. Without --publish they arrive as drafts for review.
// Signs in as the local admin with SEED_PASSWORD from the repo's .env (read at run time, never stored or printed).
// Production publishing is the owner's decision and uses their own credentials (docs/HELP_VIDEOS.md).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BRAND = process.env.VA_BRAND || "del";
const adapter = await import(`../brands/${BRAND}/brand.mjs`);
const { PLAN } = await import(`../brands/${BRAND}/plan.mjs`);
const STATE = path.join(ROOT, `brands/${BRAND}/status.json`);
const args = process.argv.slice(2);
const publish = args.includes("--publish");
const dry = args.includes("--dry-run");
const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
const ids = args.filter((a) => !a.startsWith("--"));
const todo = (ids.length ? ids : Object.keys(state)).filter((id) => state[id]?.output && fs.existsSync(state[id].output));

/** Chapters from the build's timeline: one per scene, consecutive scenes with the same chapter merged. */
const LABEL = { title: "Introduction", why: "Why it matters", access: "Where to find it", steps: "Step by step", scenario: "Scenario", tips: "Tips", summary: "Summary", note: "Good to know", phone: "On your phone", desktop: "Step by step" };
function chapters(id) {
  const work = path.join(ROOT, ".work", id);
  const tl = JSON.parse(fs.readFileSync(path.join(work, "hd/timeline.json"), "utf8"));
  const sc = JSON.parse(fs.readFileSync(path.join(work, "script.json"), "utf8")).scenes;
  const out = [];
  for (const s of sc) {
    const title = LABEL[s.chapter] || s.chapter;
    if (out.at(-1)?.title === title) continue;
    out.push({ t: Math.round(tl.starts[s.id] * 10) / 10, title });
  }
  return out;
}
const srtToVtt = (s) => "WEBVTT\n\n" + s.replace(/\r/g, "").replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, "$1.$2").trim() + "\n";

if (!todo.length) { console.log("Nothing built to publish."); process.exit(0); }
const { request } = await import(path.join(adapter.REPO, "node_modules/playwright/index.mjs"));
const rq = dry ? null : await request.newContext();
let csrf = "";
async function call(method, p, data) {
  const r = await rq.fetch(`${adapter.app.api}${p}`, { method, data, headers: { "X-CSRF-Token": csrf } });
  if (!r.ok()) throw new Error(`${method} ${p}: ${r.status()} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function put(url, body, headers) {
  const r = await rq.fetch(url, { method: "PUT", data: body, headers });
  if (!r.ok()) throw new Error(`upload failed: ${r.status()}`);
}
if (!dry) {
  csrf = (await (await rq.get(`${adapter.app.api}/auth/csrf`)).json()).csrf;
  await call("POST", "/auth/login", { email: adapter.accounts.admin.email, password: adapter.borrowAccounts().password });
  csrf = (await (await rq.get(`${adapter.app.api}/auth/csrf`)).json()).csrf;
}

for (const id of todo) {
  const plan = PLAN.find((p) => p.id === id);
  if (!plan) { console.log(`skip ${id}: not in the plan`); continue; }
  const mp4 = state[id].output;
  const base = path.basename(mp4, ".mp4");
  const cover = path.join(path.dirname(mp4), `${base}-thumbnail.png`);
  const srt = path.join(path.dirname(mp4), "captions", `${base}.en.srt`);
  const ch = chapters(id);
  console.log(`${dry ? "[dry run] " : ""}${id}: ${plan.title} · ${Math.round(state[id].seconds || 0)} s · ${ch.length} chapters${fs.existsSync(srt) ? " · captions" : ""}${publish ? " · publish" : " · draft"}`);
  if (dry) continue;
  const up = await call("POST", "/admin/help/uploads/video", { filename: path.basename(mp4), contentType: "video/mp4" });
  await put(up.uploadUrl, fs.readFileSync(mp4), up.headers);
  if (fs.existsSync(srt)) { const c = await call("POST", `/admin/help/uploads/video/${up.assetId}/captions`); await put(c.uploadUrl, Buffer.from(srtToVtt(fs.readFileSync(srt, "utf8"))), c.headers); }
  await call("POST", `/admin/help/uploads/video/${up.assetId}/complete`);
  let coverKey;
  if (fs.existsSync(cover)) {
    // A 1280 px WebP keeps the /help page light; the engine's PNG stays the master.
    const webp = path.join(ROOT, ".work", id, "cover.webp");
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", cover, "-vf", "scale=1280:-2", "-quality", "86", webp]);
    const im = await call("POST", "/admin/help/uploads/image", { contentType: "image/webp" });
    await put(im.uploadUrl, fs.readFileSync(webp), im.headers);
    coverKey = im.key;
  }
  // The worker probes the file; publishing needs it ready.
  for (let i = 0; i < 90; i++) { const a = await call("GET", `/admin/help/uploads/video/${up.assetId}`); if (a.status === "ready") break; if (a.status === "failed") throw new Error(`${id}: video processing failed`); await new Promise((r) => setTimeout(r, 2000)); }
  await call("PUT", `/admin/help/videos/${id}`, { title: plan.title, summary: plan.description, audience: plan.audience, category: plan.category, sort: plan.order, videoAssetId: up.assetId, coverKey, chapters: ch, published: publish });
  const fresh = JSON.parse(fs.readFileSync(STATE, "utf8"));
  fresh[id] = { ...fresh[id], publication: publish ? "Published (local)" : "Draft (local)", updated: new Date().toISOString().slice(0, 10) };
  fs.writeFileSync(STATE, JSON.stringify(fresh, null, 1) + "\n");
}
if (rq) await rq.dispose();
console.log("done");
