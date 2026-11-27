#!/usr/bin/env node
// Review screenshots (AGENTS.md rules 5 and 16): full-page PNGs of pages in light and dark at the given widths.
// Usage: node scripts/qa-shots.mjs --out DIR [--as student|instructor|admin] [--act-as del] [--widths 390,1440,1920] path [path…]
// Signs in like scripts/qa-dark.mjs (seed accounts, real authenticator step). QA_BASE picks the site (default :3000);
// QA_EMAIL signs in as another account that shares the seed password and authenticator (e.g. a limited test admin).
import { freshCode, seedSecret } from "./totp.mjs";
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(name); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const role = opt("--as", null);
const actAs = opt("--act-as", null); // del: switch the super admin to DEL Studio after signing in
const out = opt("--out", "qa-shots");
const widths = opt("--widths", "390,1440,1920").split(",").map(Number);
const base = process.env.QA_BASE ?? "http://127.0.0.1:3000";
const apiBase = process.env.QA_API ?? base.replace(/:(\d+)$/, (_, p) => `:${Number(p) + 1000}`);
const paths = args.length ? args : ["/"];
const users = { student: "student@del.example", instructor: "nadia@instructor.example", admin: "admin@del.example" };
const password = process.env.SEED_PASSWORD ?? readFileSync(new URL("../.env", import.meta.url), "utf8").match(/^SEED_PASSWORD=(.*)$/m)?.[1];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
let trust = null;
let usedStep;
for (const theme of ["light", "dark"]) {
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.addInitScript((t) => { try { localStorage.setItem("del-theme-v2", t); } catch {} }, theme);
    if (role) {
      if (trust) await ctx.addCookies([trust]);
      await page.goto(`${base}/login`);
      await page.getByLabel("Email").fill(process.env.QA_EMAIL ?? users[role]);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByTestId("auth-submit").click();
      await page.waitForURL((u) => !u.pathname.startsWith("/login") || u.pathname === "/login/verify");
      for (let attempt = 0; new URL(page.url()).pathname === "/login/verify" && attempt < 3; attempt++) {
        const { code, step } = await freshCode(seedSecret(), usedStep);
        usedStep = step;
        await page.getByTestId("mfa-code").fill(code);
        await page.getByTestId("trust-device").check();
        await page.getByTestId("mfa-submit").click();
        await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 5000 }).catch(() => {});
      }
      if (new URL(page.url()).pathname.startsWith("/login")) throw new Error(`could not sign in as ${role}`);
      trust = (await ctx.cookies()).find((c) => c.name === "del_trust") ?? trust;
      if (actAs) {
        const ok = await page.evaluate(async ([api, mode]) => {
          const me = await (await fetch(`${api}/api/auth/me`, { credentials: "include" })).json();
          return (await fetch(`${api}/api/auth/act-as`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": me.csrf }, body: JSON.stringify({ mode }) })).ok;
        }, [apiBase, actAs]);
        if (!ok) throw new Error(`could not switch to ${actAs}`);
      }
    }
    for (const p of paths) {
      await page.goto(base + p, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const name = `${(p.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home")}-${theme}-${w}.png`;
      await page.screenshot({ path: `${out}/${name}`, fullPage: true });
      console.log(`${out}/${name}`);
    }
    await ctx.close();
  }
}
await browser.close();
