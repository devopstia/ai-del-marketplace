import { expect, type Cookie, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const PASSWORD = process.env.E2E_PASSWORD || process.env.SEED_PASSWORD || "";
export const USERS = {
  student: "student@del.example",
  instructor: "nadia@instructor.example",
  admin: "admin@del.example",
};

/** Authenticator seeds: the demo accounts share SEED_MFA_SECRET; accounts made in a test register theirs here. */
const SEED_MFA = process.env.E2E_MFA_SECRET || process.env.SEED_MFA_SECRET || (() => { try { return readFileSync(path.join(__dirname, "..", "..", "..", ".env"), "utf8").match(/^SEED_MFA_SECRET=(.*)$/m)?.[1]?.trim() ?? ""; } catch { return ""; } })();
const seeds = new Map<string, string>();
const lastStep = new Map<string, number>();
/** "Trust this device" cookies per account, reused for the rest of the run, as a real person's browser would. */
const trusted = new Map<string, Cookie>();
export const rememberSeed = (email: string, secret: string) => seeds.set(email, secret.replace(/\s/g, ""));

function totp(secret: string, step: number) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0; const key: number[] = [];
  for (const ch of secret.toUpperCase()) { value = (value << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { key.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", Buffer.from(key)).update(c).digest(); const o = h[h.length - 1] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, "0");
}
/** A code for a step this account hasn't used yet (codes are single use; waits up to 30 s). */
export async function freshCode(email: string): Promise<string> {
  const secret = seeds.get(email) ?? SEED_MFA;
  if (!secret) throw new Error("No authenticator seed: set SEED_MFA_SECRET in .env (docs/AUTH.md)");
  let step = Math.floor(Date.now() / 30000);
  while (step <= (lastStep.get(email) ?? -1)) { await new Promise((r) => setTimeout(r, 1000)); step = Math.floor(Date.now() / 30000); }
  lastStep.set(email, step);
  return totp(secret, step);
}

/** Enters the code on /login/verify and ticks "Trust this device" (kept for later logins of this account). */
export async function passMfa(page: Page, email: string) {
  await page.getByTestId("mfa-code").fill(await freshCode(email));
  await page.getByTestId("trust-device").check();
  await page.getByTestId("mfa-submit").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  const c = (await page.context().cookies()).find((x) => x.name === "del_trust");
  if (c) trusted.set(email, c);
}

export async function login(page: Page, email: string, password = PASSWORD, next = "/student") {
  const t = trusted.get(email);
  if (t) await page.context().addCookies([t]);
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login") || u.pathname === "/login/verify");
  if (new URL(page.url()).pathname === "/login/verify") await passMfa(page, email);
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}

/** A 3-second test video made with ffmpeg (null when ffmpeg isn't installed). */
export function tinyVideo(): string | null {
  const dir = path.join(__dirname, "..", "test-results");
  const file = path.join(dir, "e2e-tiny.mp4");
  if (existsSync(file)) return file;
  try {
    mkdirSync(dir, { recursive: true });
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=15", "-f", "lavfi", "-i", "sine=frequency=440",
      "-t", "3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", file]);
    return file;
  } catch {
    return null;
  }
}

export const visible = (page: Page, testId: string) => page.getByTestId(testId).filter({ visible: true }).first();
export { expect };

/**
 * The API base this web app talks to, learned from its own /auth/me request (local, test stack or staging).
 * Call before the first navigation; read the getter once a page has loaded.
 */
export function watchApiBase(page: Page): () => string {
  let base = "";
  page.on("request", (r) => {
    const m = r.url().match(/^(.*)\/auth\/me(\?|$)/);
    if (m && !base) base = m[1];
  });
  return () => base;
}

/** An API call with the page's session and CSRF token, only for test clean-up that the UI deliberately doesn't offer. */
export async function apiFromPage(page: Page, base: string, method: "DELETE" | "POST" | "PATCH", path: string, body?: unknown): Promise<number> {
  return page.evaluate(async ({ base, method, path, body }) => {
    let csrf = decodeURIComponent(document.cookie.match(/(?:^|; )csrf=([^;]*)/)?.[1] ?? "");
    if (!csrf) csrf = ((await (await fetch(`${base}/auth/me`, { credentials: "include" })).json()) as { csrf?: string }).csrf ?? "";
    const r = await fetch(`${base}${path}`, { method, credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: body === undefined ? undefined : JSON.stringify(body) });
    return r.status;
  }, { base, method, path, body });
}
