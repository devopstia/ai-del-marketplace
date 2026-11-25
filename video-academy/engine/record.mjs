// Records every scene of a tutorial as its own clip, timed to its narration (ported from the Insurance Knowledge Hub, 2026-11-25).
// Slides reveal their parts line by line; app scenes run the tutorial's own
// script against the real application with a visible cursor and highlights.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { makeSlides } from "./slides.mjs";

const LEAD = 0.7, GAP = 0.55, TAIL = 1.0;
/** A phone-sized screen (iPhone 14/15 class), recorded 1:1 and shown in a phone frame. */
export const PHONE = { width: 390, height: 844 };

export async function recordTutorial({ tut, adapter, work, only = [] }) {
  const require = createRequire(path.join(adapter.REPO, "package.json"));
  const { chromium } = require("playwright");
  const { app } = adapter;
  const S = makeSlides(adapter.brand);
  const DUR = JSON.parse(fs.readFileSync(path.join(work, "voice/durations.json"), "utf8"));
  const timingFile = path.join(work, "clips/timing.json");
  fs.mkdirSync(path.dirname(timingFile), { recursive: true });
  const timing = fs.existsSync(timingFile) ? JSON.parse(fs.readFileSync(timingFile, "utf8")) : {};
  const stamp = Date.now().toString(36);

  const keys = [...new Set([tut.who, ...(tut.accounts || []), ...tut.scenes.map((s) => s.who)].filter((k) => k && k !== "anon"))];
  const lease = keys.length ? adapter.borrowAccounts(keys) : { password: "", restore: () => {} };
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctxOf = {};
  const memFile = path.join(work, "mem.json");
  const mem = (tut.mem ||= fs.existsSync(memFile) ? JSON.parse(fs.readFileSync(memFile, "utf8")) : {});
  const val = (x) => (typeof x === "function" ? x(mem) : x);
  try {
    const api = async (who) => { const st = await adapter.storageFor(who, lease.password); return st; };
    if (tut.setup) await tut.setup({ adapter, api, password: lease.password, mem });
    for (const scene of tut.scenes) {
      if (only.length && !only.includes(scene.id)) continue;
      const starts = []; let t = LEAD;
      scene.lines.forEach((_, i) => { starts.push(t); t += DUR[`${scene.id}_${i}`] + GAP; });
      const total = t - GAP + TAIL;
      const who = scene.who || tut.who;
      const st = scene.type === "app" ? (scene.freshLogin ? (ctxOf[who] = await adapter.storageFor(who, lease.password)) : (ctxOf[who] ||= await adapter.storageFor(who, lease.password))) : { state: undefined };
      const dir = path.join(work, `clips/raw-${scene.id}-${stamp}`);
      const phone = scene.device === "phone";
      const vp = phone ? PHONE : app.viewport;
      const ctx = await browser.newContext({ viewport: vp, colorScheme: app.colorScheme || "light", recordVideo: { dir, size: vp }, storageState: st.state, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), ...(scene.context || {}) });
      await ctx.addInitScript(OVERLAY, { pattern: app.hideTextPattern, phone, accent: adapter.brand.colors.primary, ink: adapter.brand.colors.bg });
      const page = await ctx.newPage();
      const v0 = Date.now();
      if (scene.type !== "app") {
        if (scene.prepare) scene.prepare(scene, mem);
        if (scene.shotUrl && !scene.shot) scene.shot = await shoot(browser, adapter, scene, ctxOf, tut, lease, work, val);
        const html = (scene.type === "html" ? S.T.html : S.T[scene.type])(tut, scene);
        await page.setContent(html, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
      } else {
        if (scene.before) await scene.before({ page, ctx, adapter, token: st.token });
        await page.goto(app.base + val(scene.from || scene.url));
        await page.waitForLoadState("networkidle").catch(() => {});
        if ((scene.expand ?? app.expandSidebar ?? true) && !phone) await expandSidebar(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(450);
        await page.mouse.move(vp.width * 0.62, vp.height * 0.45);
      }
      const t0 = Date.now();
      const h = helpers({ page, ctx, app, starts, total, t0, DUR, scene, token: st.token, adapter });
      h.mem = mem;
      try {
        if (scene.type !== "app") { const last = scene.lines.length - 1; for (let i = 0; i <= last; i++) { await h.line(i); await h.reveal(i === last ? 99 : i); } }
        else {
          if (scene.from && scene.url && scene.from !== scene.url) await h.openTab(val(scene.url), scene.group);
          if (scene.run) await scene.run(h);
        }
      } catch (e) { console.log("  ! scene", scene.id, String(e.message).split("\n")[0]); }
      await h.end();
      const trim = (t0 - v0) / 1000;
      await ctx.close();
      const raw = fs.readdirSync(dir).map((f) => path.join(dir, f))[0];
      timing[scene.id] = { raw, trim, total, starts, revealAll: true };
      if (phone) {
        // The phone recording is composited into a phone frame on a branded stage (engine/media.py assemble).
        const bgp = await browser.newPage({ viewport: app.viewport, deviceScaleFactor: 1.25 });
        await bgp.setContent(S.T.phonestage(tut, scene)); await bgp.evaluate(() => document.fonts.ready); await bgp.evaluate(() => window.reveal(99)); await bgp.waitForTimeout(150);
        const bg = path.join(work, `clips/phonebg-${scene.id}.png`); await bgp.screenshot({ path: bg }); await bgp.close();
        timing[scene.id].phone = { bg, x: 1150, y: 86, w: 420, h: 909 };
      }
      fs.writeFileSync(timingFile, JSON.stringify(timing, null, 1));
      fs.writeFileSync(path.join(work, "mem.json"), JSON.stringify(mem));
      console.log(`  ${scene.id} ${scene.type} ${total.toFixed(1)}s`);
    }
    if (tut.cleanup) await tut.cleanup({ adapter, api, password: lease.password, mem });
    fs.writeFileSync(path.join(work, "mem.json"), JSON.stringify(mem));
  } finally {
    await browser.close();
    lease.restore();
  }
}

/** A clean screenshot of an app page (for slides), taken before the slide is recorded. */
async function shoot(browser, adapter, scene, ctxOf, tut, lease, work, val) {
  const who = scene.shotWho || tut.who;
  const st = (ctxOf[who] ||= await adapter.storageFor(who, lease.password));
  const ctx = await browser.newContext({ viewport: adapter.app.viewport, deviceScaleFactor: 2, colorScheme: adapter.app.colorScheme || "light", storageState: st.state, ...(scene.shotDevice || {}) });
  await ctx.addInitScript(OVERLAY, { pattern: adapter.app.hideTextPattern, accent: adapter.brand.colors.primary, ink: adapter.brand.colors.bg });
  const p = await ctx.newPage(); await p.goto(adapter.app.base + val(scene.shotUrl)); await p.waitForLoadState("networkidle").catch(() => {});
  if (adapter.app.expandSidebar ?? true) await expandSidebar(p);
  await p.evaluate(() => { const c = document.getElementById("v-cursor"); if (c) c.style.display = "none"; }); await p.waitForTimeout(700);
  const file = path.join(work, `shots/${scene.id}.png`); fs.mkdirSync(path.dirname(file), { recursive: true }); await p.screenshot({ path: file }); await ctx.close();
  return file;
}

async function expandSidebar(page) {
  for (let k = 0; k < 5; k++) {
    const closed = page.locator('aside button[aria-expanded="false"]');
    const n = await closed.count(); if (!n) break;
    for (let i = 0; i < n; i++) await closed.nth(0).click().catch(() => {});
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => document.querySelectorAll("aside, aside *").forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }));
}

function helpers({ page, ctx, app, starts, total, t0, DUR, scene, token, adapter }) {
  const vp = scene.device === "phone" ? PHONE : app.viewport;
  const W = vp.width, H = vp.height;
  const now = () => (Date.now() - t0) / 1000;
  const until = async (sec) => { const ms = (sec - now()) * 1000; if (ms > 0) await page.waitForTimeout(ms); };
  const asLoc = (x) => (typeof x === "string" ? page.locator("main").getByText(x, { exact: false }).first() : x);
  const h = {
    page, ctx, W, H, token, adapter, base: app.base,
    dur: (i) => DUR[`${scene.id}_${i}`],
    line: (i) => until(starts[i]),
    at: (i, off) => until(starts[i] + (off < 1 && off > 0 ? DUR[`${scene.id}_${i}`] * off : off)),
    end: () => until(total),
    pause: (ms) => page.waitForTimeout(ms),
    reveal: (n) => page.evaluate((x) => window.reveal && window.reveal(x), n),
    async ring(x, pad = 6) { const l = asLoc(x); await l.evaluate((el, p) => window.__ring(el, p), pad).catch(() => {}); },
    unring: () => page.evaluate(() => window.__ring(null)).catch(() => {}),
    async moveTo(x, o = {}) {
      const loc = asLoc(x);
      if (!(await loc.count().catch(() => 0))) return null;
      await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      const b = await loc.boundingBox().catch(() => null); if (!b) return null;
      const px = b.x + (o.dx ?? Math.min(b.width / 2, 120)), py = b.y + (o.dy ?? b.height / 2);
      await page.mouse.move(px, py, { steps: o.steps ?? 26 }); return { x: px, y: py };
    },
    async show(x, ms = 1400, pad = 6) { await h.moveTo(x); await h.ring(x, pad); await page.waitForTimeout(ms); await h.unring(); },
    async click(x, o) { if (!(await h.moveTo(x, o))) return false; await page.waitForTimeout(240); await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up(); return true; },
    async type(x, text, delay = 55) { await h.click(x); await page.keyboard.press("Control+A").catch(() => {}); await page.keyboard.type(text, { delay }); },
    async glide(dy, ms = 1400) {
      if (scene.device === "phone") { const n = 30; for (let k = 0; k < n; k++) { await page.evaluate((d) => window.scrollBy(0, d), dy / n); await page.waitForTimeout(ms / n); } return; }
      await page.mouse.move(W * 0.64, H * 0.55, { steps: 10 }); const n = 40; for (let k = 0; k < n; k++) { await page.mouse.wheel(0, dy / n); await page.waitForTimeout(ms / n); } },
    async top() { await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await page.waitForTimeout(600); },
    text: (t) => page.locator("main").getByText(t, { exact: false }).first(),
    exact: (t) => page.locator("main").getByText(t, { exact: true }).first(),
    btn: (name, scope = "main") => page.locator(scope).getByRole("button", { name }).first(),
    link: (name, scope = "main") => page.locator(scope).getByRole("link", { name }).first(),
    dialog: () => page.getByRole("dialog").last(),
    side: (href) => page.locator(`aside a[href="${href}"]`).first(),
    group: (name) => page.locator("aside button").filter({ hasText: name }).first(),
    header: (name) => page.locator("header").getByRole("button", { name }).first(),
    async goto(p) { await page.goto(app.base + p); await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(400); },
    async settle() { await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(300); },
    /** Highlights the sidebar path (group, then link), clicks it and points at the page title. */
    async openTab(href, group) {
      if (group) { const g = h.group(group); if (await g.count()) { await h.moveTo(g); await h.ring(g, 4); await page.waitForTimeout(1100); } }
      const l = h.side(href); await h.moveTo(l); await h.ring(l, 4); await page.waitForTimeout(1000);
      await h.click(l); await page.waitForURL((u) => u.pathname === href, { timeout: 15000 }).catch(() => {});
      await h.settle(); await h.unring();
      const t = page.locator("main h1").first(); if (await t.count()) { await h.moveTo(t, { steps: 18 }); await h.ring(t, 8); await page.waitForTimeout(1000); await h.unring(); }
    },
    async scrollPanelsTop() { await page.evaluate(() => { for (const e of document.querySelectorAll("main *")) { const st = getComputedStyle(e); if (/(auto|scroll)/.test(st.overflowY) && e.scrollHeight > e.clientHeight + 40 && e.getBoundingClientRect().width > 400) e.scrollTo({ top: 0, behavior: "smooth" }); } }); },
  };
  return h;
}

/** Runs in every recorded page: cursor, click ripples, highlight ring, test-data filter. */
function OVERLAY({ pattern: hidePattern, phone, accent = "#1A3FD6", ink = "#0B1B3F" }) {
  const css = `#v-cursor{position:fixed;z-index:2147483647;width:24px;height:24px;pointer-events:none;left:-40px;top:-40px}
  #v-cursor svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
  .v-ripple{position:fixed;z-index:2147483646;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:3px solid ${accent};pointer-events:none;animation:vr .6s ease-out forwards}
  @keyframes vr{from{transform:scale(.3);opacity:1}to{transform:scale(1.6);opacity:0}}
  #v-ring{position:fixed;z-index:2147483644;border:3px solid ${accent};border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,.28);pointer-events:none;opacity:0;transition:opacity .35s}
  #v-ring.on{opacity:1}`;
  const add = () => {
    if (document.getElementById("v-cursor")) return;
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const c = document.createElement("div"); c.id = "v-cursor";
    c.innerHTML = phone ? '<div style="width:30px;height:30px;margin:-12px 0 0 -12px;border-radius:50%;background:'+accent+'47;border:2px solid '+accent+'bf"></div>' : '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M3 2l7 19 2.6-7.4L20 11z" fill="#fff" stroke="'+ink+'" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const r = document.createElement("div"); r.id = "v-ring"; document.body.appendChild(r);
    const last = sessionStorage.getItem("v-last"); if (last) { const [x, y] = JSON.parse(last); c.style.left = x - 3 + "px"; c.style.top = y - 2 + "px"; }
  };
  const ready = () => (document.body ? add() : requestAnimationFrame(ready)); ready();
  document.addEventListener("mousemove", (e) => { const c = document.getElementById("v-cursor"); if (c) { c.style.left = e.clientX - 3 + "px"; c.style.top = e.clientY - 2 + "px"; } try { sessionStorage.setItem("v-last", JSON.stringify([e.clientX, e.clientY])); } catch {} }, true);
  document.addEventListener("mousedown", (e) => { const r = document.createElement("div"); r.className = "v-ripple"; r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px"; document.body.appendChild(r); setTimeout(() => r.remove(), 700); }, true);
  let ringEl = null;
  window.__ring = (el, pad = 6) => { ringEl = el || null; const ring = document.getElementById("v-ring"); if (ring) ring.classList.toggle("on", !!el); ring && (ring.dataset.pad = pad); };
  const follow = () => { const ring = document.getElementById("v-ring"); if (ringEl && ring) { const p = +ring.dataset.pad || 6; const r = ringEl.getBoundingClientRect(); Object.assign(ring.style, { left: r.left - p + "px", top: r.top - p + "px", width: r.width + p * 2 + "px", height: r.height + p * 2 + "px" }); } requestAnimationFrame(follow); };
  requestAnimationFrame(follow);
  const re = new RegExp(hidePattern);
  setInterval(() => { for (const el of document.querySelectorAll("body *")) { if (el.children.length === 0 && re.test(el.textContent || "")) { const box = el.closest("li, tr, article, [role=menuitem], [class*='rounded-xl'], [class*='rounded-2xl'], [class*='rounded-lg']"); if (box && box !== document.body && !box.contains(document.querySelector("main h1"))) box.style.display = "none"; } } }, 200);
}
