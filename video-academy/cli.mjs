#!/usr/bin/env node
// Video Academy command line.
//   node cli.mjs list                       planned and built tutorials
//   node cli.mjs build <id...> [--from S] [--only scene,scene]
//        stages: script voice record cover assemble deck qa
//   node cli.mjs inventory                  regenerate the brand's inventory (docs/DEL_HELP_VIDEO_INVENTORY.md)
//   node cli.mjs status <id> <status>       set review/publication status
// Env: VA_BRAND (default del), VA_OUT (output root), VA_BASE_URL. Ported from the Insurance Knowledge Hub (2026-11-25).
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { recordTutorial } from "./engine/record.mjs";
import { makeSlides } from "./engine/slides.mjs";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const BRAND = process.env.VA_BRAND || "del";
const adapter = await import(`./brands/${BRAND}/brand.mjs`);
const { PLAN } = await import(`./brands/${BRAND}/plan.mjs`);
const OUT = adapter.outRoot || process.env.VA_OUT || path.join(process.env.HOME, "work/videos/academy");
const PY = path.join(ROOT, ".venv/bin/python");
const STATE = path.join(ROOT, `brands/${BRAND}/status.json`);
const STAGES = ["script", "voice", "record", "cover", "assemble", "deck", "qa"];

const state = () => (fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : {});
const saveState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 1) + "\n");
const catOf = (id) => adapter.categories.findIndex(([k]) => k === id);

async function loadTutorial(id) {
  const file = path.join(ROOT, "tutorials", `${id}.mjs`);
  if (!fs.existsSync(file)) throw new Error(`no tutorial spec: tutorials/${id}.mjs`);
  const t = (await import(file + `?v=${Date.now()}`)).default;
  const plan = PLAN.find((p) => p.id === id) || {};
  const tut = { ...plan, ...t };
  tut.categoryName = adapter.categories.find(([k]) => k === tut.category)?.[1] || tut.category;
  const ci = catOf(tut.category);
  tut.outDir = path.join(OUT, `${String(ci + 1).padStart(2, "0")}-${tut.category}`);
  tut.base = `${String(tut.order).padStart(2, "0")}-${tut.id}`;
  tut.scenes.forEach((s, k) => (s.id ||= `s${String(k + 1).padStart(2, "0")}`));
  const shots = path.join(ROOT, ".work", id, "shots");
  const memf = path.join(ROOT, ".work", id, "mem.json"); tut.mem = fs.existsSync(memf) ? JSON.parse(fs.readFileSync(memf, "utf8")) : {};
  tut.scenes.forEach((s) => { if (s.prepare && Object.keys(tut.mem).length) { try { s.prepare(s, tut.mem); } catch {} } });
  tut.scenes.forEach((s) => { if (s.shotUrl && fs.existsSync(path.join(shots, `${s.id}.png`))) s.shot = path.join(shots, `${s.id}.png`); });
  return tut;
}

function py(...args) { const r = spawnSync(PY, [path.join(ROOT, "engine/media.py"), ...args], { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" }); if (r.status) throw new Error(`media.py ${args[0]} failed`); const last = r.stdout.trim().split("\n").pop(); try { return JSON.parse(last); } catch { return last; } }

async function renderStills(tut, work) {
  const require = createRequire(path.join(adapter.REPO, "package.json"));
  const { chromium } = require("playwright");
  const S = makeSlides(adapter.brand);
  const t = JSON.parse(fs.readFileSync(path.join(work, "clips/timing.json"), "utf8"));
  fs.mkdirSync(path.join(work, "stills"), { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: adapter.app.viewport, deviceScaleFactor: 1.25, colorScheme: adapter.app.colorScheme || "light" });
  const man = [];
  for (const [k, s] of tut.scenes.entries()) {
    const file = path.join(work, `stills/${String(k + 1).padStart(2, "0")}-${s.id}.png`);
    if (s.type === "app") {
      const x = t[s.id]; const hd = path.join(work, `hd/${s.id}.mp4`);
      if (fs.existsSync(hd)) execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-ss", String(x.total * (s.stillAt ?? 0.6)), "-i", hd, "-frames:v", "1", file]);
      else execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-ss", String(x.trim + x.total * (s.stillAt ?? 0.6)), "-i", x.raw, "-frames:v", "1", "-vf", "scale=1920:1080", file]);
    } else {
      await p.setContent((s.type === "html" ? S.T.html : S.T[s.type])(tut, s)); await p.evaluate(() => document.fonts.ready);
      await p.evaluate(() => { document.querySelectorAll("[data-r]").forEach((e) => (e.style.transition = "none")); window.reveal && window.reveal(99); }); await p.waitForTimeout(120);
      await p.screenshot({ path: file });
    }
    man.push({ id: s.id, file });
  }
  await b.close();
  fs.writeFileSync(path.join(work, "stills/manifest.json"), JSON.stringify(man, null, 1));
}

async function renderCover(tut, work, out) {
  const require = createRequire(path.join(adapter.REPO, "package.json"));
  const { chromium } = require("playwright");
  const S = makeSlides(adapter.brand); const C = adapter.brand.colors;
  const t = JSON.parse(fs.readFileSync(path.join(work, "clips/timing.json"), "utf8"));
  const app = tut.scenes.find((s) => s.id === tut.coverScene) || tut.scenes.find((s) => s.type === "app");
  const shot = path.join(work, "cover-shot.png");
  if (app) { const x = t[app.id]; execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-ss", String(x.trim + x.total * (tut.coverAt ?? 0.5)), "-i", x.raw, "-frames:v", "1", shot]); }
  const mins = tut._seconds ? `${Math.floor(Math.round(tut._seconds) / 60)}:${String(Math.round(tut._seconds) % 60).padStart(2, "0")}` : "";
  const F = adapter.brand.fontDisplay;
  const html = `<html><head><style>${S.CSS}
  body{width:1280px;height:720px}.win{position:absolute;right:-90px;top:118px;width:760px;transform:perspective(1600px) rotateY(-9deg) rotateX(2deg)}
  .l{position:absolute;left:68px;top:74px;width:560px}.tag{display:inline-flex;font-size:14px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${C.primary};background:${C.primarySoft || C.primary + "14"};border:1px solid ${C.lineStrong || C.primary + "38"};padding:8px 14px;border-radius:999px}
  .ttl{font-family:${F};font-size:${tut.short.length > 24 ? 54 : 62}px;line-height:1.04;font-weight:800;letter-spacing:-.03em;color:${C.ink};margin-top:22px}.sub{font-size:20px;line-height:1.45;color:${C.body};margin-top:18px;max-width:520px}
  .play{margin-top:30px;display:inline-flex;align-items:center;gap:14px;background:${C.primary};color:${C.onPrimary || "#fff"};font-family:${F};font-size:20px;font-weight:700;border-radius:999px;padding:12px 24px 12px 12px;box-shadow:0 14px 30px ${C.primary}40}
  .play b{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.14)}
  .bl{position:absolute;left:68px;bottom:52px;display:flex;align-items:center;gap:14px}.bl span{width:64px;height:32px}.bl b{display:block;font-family:${F};font-size:21px;color:${C.ink}}.bl i{display:block;font-style:normal;font-size:11.5px;font-weight:700;letter-spacing:.2em;color:${C.primary};margin-top:3px}
  .pa{position:absolute;right:54px;top:44px;font-size:13.5px;font-weight:700;letter-spacing:.16em;color:${C.muted}}</style></head><body><div class="bg"><div class="grid"></div></div><div class="pa">${adapter.brand.academy.toUpperCase()}</div>
  ${app ? (t[app.id]?.phone ? `<div style="position:absolute;right:120px;top:70px;width:300px;height:640px;border-radius:46px;background:#05060f;padding:12px;box-shadow:0 30px 70px rgba(0,0,0,.45);transform:rotate(-4deg)"><img src="${S.img(shot)}" style="width:100%;height:100%;object-fit:cover;border-radius:36px"></div>` : S.win(shot)) : ""}<div class="l"><div class="tag">${tut.categoryName}</div><div class="ttl">${tut.short}</div><div class="sub">${tut.subtitle || tut.description}</div>
  <div class="play"><b><svg width="16" height="16" viewBox="0 0 24 24"><path d="M7 4v16l13-8z" fill="currentColor"/></svg></b>Watch${mins ? " · " + mins : ""}</div></div>
  <div class="bl"><span>${S.LOGO}</span><div><b>${adapter.brand.name}</b><i>${adapter.brand.tagline}</i></div></div></body></html>`;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: adapter.app.colorScheme || "light" });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: out }); await b.close();
}

async function build(id, from = "script", only = []) {
  const tut = await loadTutorial(id);
  const work = path.join(ROOT, ".work", id); fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(tut.outDir, { recursive: true });
  const mp4 = path.join(tut.outDir, tut.base + ".mp4"), cover = path.join(tut.outDir, tut.base + "-thumbnail.png");
  const run = (st) => STAGES.indexOf(st) >= STAGES.indexOf(from);
  const st = state(); st[id] ||= {}; const rec = st[id];
  console.log(`\n== ${id}: ${tut.title}`);
  if (run("script")) { fs.writeFileSync(path.join(work, "script.json"), JSON.stringify({ title: tut.title, say: adapter.brand.voice.say || {}, scenes: tut.scenes.map((s) => ({ id: s.id, chapter: s.chapter || s.type, lines: s.lines })) }, null, 1)); rec.production = "Script Completed"; }
  const v = adapter.brand.voice;
  if (run("voice")) { const r = py("voice", work, path.join(ROOT, ".models"), v.voice, String(v.speed), v.lang); rec.voice = r; console.log("  voice", r.minutes, "min, mismatches", r.mismatches.length); }
  if (run("record")) { await recordTutorial({ tut, adapter, work, only }); rec.production = "Recording Completed"; }
  if (run("cover") || run("assemble")) { const est = JSON.parse(fs.readFileSync(path.join(work, "clips/timing.json"), "utf8")); tut._seconds = tut.scenes.reduce((a, s) => a + (est[s.id]?.total || 0) - 0.5, 0.5); await renderCover(tut, work, cover); }
  if (run("assemble")) { const r = py("assemble", work, mp4, cover); rec.seconds = r.seconds; rec.production = "Video Generated"; }
  if (run("deck")) { await renderStills(tut, work); py("deck", work, path.join(tut.outDir, tut.base + "-presentation.pptx"), path.join(tut.outDir, tut.base + "-presentation.pdf"), tut.title); }
  if (run("qa")) { const r = py("qa", work, mp4); rec.qa = { match: r.match, differences: r.differences, lufs: r.lufs, true_peak: r.true_peak, sheet: r.sheet }; console.log("  qa match", r.match, "lufs", r.lufs, r.differences.length ? r.differences : ""); }
  rec.output = mp4; rec.review ||= "Under Review"; rec.publication ||= "Not published"; rec.updated = new Date().toISOString().slice(0, 10);
  const fresh = state(); fresh[id] = { ...(fresh[id] || {}), ...rec }; saveState(fresh); writeInventory();
}

function writeInventory() {
  const st = state(); const C = adapter.categories;
  const rows = PLAN.map((p) => ({ ...p, ...(st[p.id] || {}), spec: fs.existsSync(path.join(ROOT, "tutorials", `${p.id}.mjs`)) }));
  const prodOf = (r) => r.existing ? "Video Generated" : r.production || (r.spec ? "Script Completed" : "Planned");
  const count = (f) => rows.filter(f).length;
  const INV = adapter.inventoryFile || "docs/VIDEO_INVENTORY.md";
  const L = [`# ${adapter.inventoryTitle || "Video Inventory"}`, "", `Generated by \`node cli.mjs inventory\` on ${new Date().toISOString().slice(0, 10)}. Source of truth: \`brands/${BRAND}/plan.mjs\` (what is needed) and \`brands/${BRAND}/status.json\` (what is done). Do not edit this file by hand.`, "",
    `**${rows.length} videos planned** · ${count((r) => prodOf(r) === "Video Generated")} generated · ${count((r) => r.review === "Approved")} approved · ${count((r) => r.publication === "Published")} published · ${count((r) => prodOf(r) === "Planned")} still to produce.`, "",
    "Statuses: Planned → Script Completed → Recording Completed → Video Generated → Under Review → Approved → Published.", ""];
  for (const [k, name, desc] of C) {
    const rs = rows.filter((r) => r.category === k).sort((a, b) => a.order - b.order); if (!rs.length) continue;
    L.push(`## ${name}`, "", desc, "", "| # | Title | For | Page or feature | Scenario | Production | Review | Publication | Length | File |", "|---|---|---|---|---|---|---|---|---|---|");
    for (const r of rs) L.push(`| ${r.order} | ${r.title} | ${r.audience} | ${r.feature} | ${r.scenario || ""} | ${prodOf(r)} | ${r.review || "Not reviewed"} | ${r.publication || "Not published"} | ${r.seconds ? `${Math.floor(Math.round(r.seconds) / 60)}:${String(Math.round(r.seconds) % 60).padStart(2, "0")}` : ""} | ${r.output ? "`" + r.output.replace(/^\/home\/[^/]+\//, "~/") + "`" : r.existing ? "`" + r.existing + "`" : ""} |`);
    L.push("");
  }
  const notes = PLAN.filter((p) => p.limitation); if (notes.length) { L.push("## Limitations found during the audit", ""); for (const p of notes) L.push(`- **${p.title}:** ${p.limitation}`); L.push(""); }
  fs.writeFileSync(path.join(ROOT, INV), L.join("\n"));
}

const [cmd, ...args] = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : null; };
if (cmd === "build") { const from = flag("--from") || "script"; const only = (flag("--only") || "").split(",").filter(Boolean); for (const id of args) await build(id, from, only); }
else if (cmd === "restore-accounts") { console.log("restored", adapter.restoreAccounts ? adapter.restoreAccounts() : 0, "account(s)"); }
else if (cmd === "inventory") { writeInventory(); console.log((adapter.inventoryFile || "docs/VIDEO_INVENTORY.md") + " written"); }
else if (cmd === "status") { const st = state(); st[args[0]] ||= {}; const [k, v] = args[1].includes("=") ? args[1].split("=") : ["review", args[1]]; st[args[0]][k] = v; saveState(st); writeInventory(); }
else if (cmd === "list") { const st = state(); for (const p of PLAN) console.log(`${p.category.padEnd(18)} ${String(p.order).padStart(2)} ${p.id.padEnd(34)} ${fs.existsSync(path.join(ROOT, "tutorials", p.id + ".mjs")) ? "spec" : "    "} ${st[p.id]?.production || ""}`); }
else console.log("usage: node cli.mjs list | build <id...> [--from stage] [--only s01,s02] | inventory | status <id> <Approved|Published|...>");
