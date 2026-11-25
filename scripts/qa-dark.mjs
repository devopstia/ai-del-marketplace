#!/usr/bin/env node
// Dark-mode QA scan (AGENTS.md rule 16). Opens pages in a real browser in the default dark theme and reports:
//  - text whose contrast against its actual background is under WCAG AA (4.5:1; 3:1 for large text),
//  - pages that scroll sideways.
// Usage: node scripts/qa-dark.mjs [--as student|instructor|admin] [--widths 390,768,1440] [--light] path [path…]
// Signs in with the seed accounts (SEED_PASSWORD from .env). Exit code 1 when anything fails.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(name); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (name) => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; };
const role = opt("--as", null);
const widths = opt("--widths", "390,1440").split(",").map(Number);
const light = flag("--light");
const base = process.env.QA_BASE ?? "http://127.0.0.1:3000";
const paths = args.length ? args : ["/"];
const users = { student: "student@del.example", instructor: "nadia@instructor.example", admin: "admin@del.example" };
const password = process.env.SEED_PASSWORD ?? readFileSync(new URL("../.env", import.meta.url), "utf8").match(/^SEED_PASSWORD=(.*)$/m)?.[1];

/** Runs in the page: every visible text run, its colour, its effective background and the contrast between them. */
function scan() {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  /** Background under an element: blend semi-transparent layers up the tree; unknown over images and gradients. */
  const background = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
      if (["IMG", "VIDEO", "CANVAS", "svg"].includes(n.tagName)) return null;
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    if (!layers.length || layers[layers.length - 1].a < 1) bg = parse(getComputedStyle(document.body).backgroundColor) ?? bg;
    for (const l of layers.reverse()) bg = over(l, bg);
    return bg;
  };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const text = t.textContent.replace(/\s+/g, " ").trim();
    const el = t.parentElement;
    if (!text || !el || seen.has(el)) continue;
    seen.add(el);
    // Text drawn over a picture or video can't be measured here: containers marked data-qa-on-media are checked by eye.
    if (el.closest("svg, [aria-hidden='true'], .sr-only, script, style, noscript, [data-qa-on-media]")) continue;
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    let fg = parse(cs.color);
    if (!fg) continue;
    let alpha = 1;
    for (let n = el; n; n = n.parentElement) alpha *= Number(getComputedStyle(n).opacity);
    if (alpha < 0.1) continue;
    const bg = background(el);
    if (!bg) continue;
    fg = over({ ...fg, a: fg.a * alpha }, bg);
    const size = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    // Disabled controls are exempt from contrast rules (WCAG 1.4.3).
    if (el.closest("button:disabled, input:disabled, [aria-disabled='true'], label:has(input:disabled)")) continue;
    const need = large ? 3 : 4.5;
    const got = ratio(fg, bg);
    if (got + 0.005 < need) out.push({ text: text.slice(0, 70), ratio: Math.round(got * 100) / 100, need, color: cs.color, size, where: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ").slice(0, 4).join(".") : "") });
  }
  return { failures: out, overflow: document.documentElement.scrollWidth - window.innerWidth };
}

const browser = await chromium.launch();
let bad = 0;
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  if (light) await page.addInitScript(() => { try { localStorage.setItem("del-theme-v2", "light"); } catch {} });
  if (role) {
    await page.goto(`${base}/login`);
    await page.getByLabel("Email").fill(users[role]);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByTestId("auth-submit").click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  }
  for (const p of paths) {
    await page.goto(base + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const r = await page.evaluate(scan);
    const tag = `${p} @${w}${role ? ` as ${role}` : ""}${light ? " (light)" : ""}`;
    if (!r.failures.length && r.overflow <= 0) { console.log(`ok    ${tag}`); continue; }
    bad++;
    console.log(`FAIL  ${tag}${r.overflow > 0 ? `  (scrolls sideways by ${r.overflow}px)` : ""}`);
    const uniq = new Map();
    for (const f of r.failures) uniq.set(`${f.color}|${f.where}`, f);
    for (const f of [...uniq.values()].slice(0, 25)) console.log(`      ${f.ratio}:1 < ${f.need}  "${f.text}"  ${f.color}  ${f.size}px  <${f.where}>`);
  }
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
