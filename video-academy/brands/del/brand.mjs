// DevOps Easy Learning brand and application adapter for the video engine. Everything specific to DEL lives here:
// colours (the site's dark tokens), logo, fonts, the local app, the demo accounts and how to sign them in.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(new URL(import.meta.url).pathname);
export const REPO = path.resolve(HERE, "../../..");
const FONTS = path.join(REPO, "apps/api/assets/fonts");

const LEFT = "M60,30 C48,14 34,8 22,10 C10,12 4,22 4,30 C4,38 10,48 22,50 C34,52 48,46 60,30";
const RIGHT = "M60,30 C72,46 86,52 98,50 C110,48 116,38 116,30 C116,22 110,12 98,10 C86,8 72,14 60,30";

export const brand = {
  name: "DevOps Easy Learning",
  short: "DEL",
  tagline: "LEARN BY DOING",
  academy: "Help videos",
  url: "devopseasylearning.com",
  /** The site's dark theme (apps/web/src/app/globals.css): dark is DEL's primary design. */
  colors: {
    dark: true, bg: "#0c0f22", surface: "#141834", surface2: "#1b2042", line: "#262c52", lineStrong: "#363d6b",
    ink: "#e8eaf7", body: "#c9cce3", muted: "#9599b8", primary: "#9d8fff", primary2: "#58c3f2", deep: "#241f55",
    primarySoft: "#241f55", onPrimary: "#12103a", teal: "#58c3f2", good: "#3fcf92", goodSoft: "#0f3326", warn: "#ff7d93", warnSoft: "#40151f",
  },
  /** Headings in Schibsted Grotesk (the DEL font, bundled), body in Atkinson Hyperlegible Next like the site. */
  fontCss: () => {
    const b64 = (w) => fs.readFileSync(path.join(FONTS, `SchibstedGrotesk-${w}.ttf`)).toString("base64");
    return `@import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;500;700&display=block');
${[600, 700, 800].map((w) => `@font-face{font-family:Display;src:url(data:font/ttf;base64,${b64(w)}) format('truetype');font-weight:${w}}`).join("\n")}`;
  },
  fontBody: "'Atkinson Hyperlegible Next', Display, system-ui, sans-serif",
  fontDisplay: "Display, system-ui, sans-serif",
  /** The DEL loop. `bg` is ignored (the loop has no tile); kept for the engine's signature. */
  logoSvg: () => `<svg viewBox="0 0 120 60" width="100%" height="100%" fill="none" stroke-width="10" stroke-linecap="round"><path d="${LEFT}" stroke="#9d8fff"/><path d="${RIGHT}" stroke="#58c3f2"/></svg>`,
  voice: { model: "kokoro", voice: "af_heart", speed: 0.97, lang: "en-us",
    /** Spoken forms for words the voice mispronounces (captions and slides keep the written form). */
    say: { DEL: "D E L", DevOps: "Dev Ops", Kubernetes: "Koo-ber-net-ees", CC: "C C", PWA: "P W A", URL: "U R L" } },
};

/** The running application (local docker compose stack). */
export const app = {
  base: process.env.VA_BASE_URL || "http://127.0.0.1:3000",
  api: process.env.VA_API_URL || "http://127.0.0.1:4000/api",
  viewport: { width: 1536, height: 864 },
  colorScheme: "dark",
  /** localStorage set before every page: the site's dark theme, captions off, install hint dismissed. */
  initialStorage: [{ name: "del-theme-v2", value: "dark" }, { name: "del-install-hint-dismissed", value: "1" }],
  /** Leftover automated-test data, hidden in every shot. */
  hideTextPattern: String.raw`\bE2E\b|e2e\.example|\bcp-course\b|\d{12,}`,
};

/** The seed's fictional demo accounts (local stack only). `key` is what tutorials use. */
export const accounts = {
  student: { email: "student@del.example", name: "Sam Student" },
  instructor: { email: "nadia@instructor.example", name: "Nadia Rahman" },
  admin: { email: "admin@del.example", name: "Platform Admin" },
};

/**
 * The local seed password is read from the repo's .env at run time and never stored or printed.
 * (Unlike the Hub, DEL's demo accounts exist only on local stacks, so nothing needs to be borrowed and restored.)
 */
export function borrowAccounts() {
  const env = fs.readFileSync(path.join(REPO, ".env"), "utf8");
  const pw = env.match(/^SEED_PASSWORD=(.*)$/m)?.[1]?.trim();
  if (!pw) throw new Error("SEED_PASSWORD is missing from .env (run ./scripts/make-env.sh and the seed)");
  return { password: pw, restore: () => {} };
}
export const restoreAccounts = () => 0;

const sessions = {};
/** Signs in through the API (httpOnly cookie session) and returns Playwright storage for the web app. */
export async function storageFor(key, password) {
  const origins = [{ origin: app.base, localStorage: app.initialStorage }];
  if (!key || key === "anon") return { state: { cookies: [], origins }, token: null };
  if (sessions[key]) return sessions[key];
  const { request } = await import(path.join(REPO, "node_modules/playwright/index.mjs"));
  const rq = await request.newContext();
  const csrf = (await (await rq.get(`${app.api}/auth/csrf`)).json()).csrf;
  const r = await rq.post(`${app.api}/auth/login`, { data: { email: accounts[key].email, password }, headers: { "X-CSRF-Token": csrf } });
  if (!r.ok()) throw new Error(`sign-in failed for ${key}: ${r.status()} ${(await r.text()).slice(0, 120)}`);
  // Two-step sign-in: demo accounts use SEED_MFA_SECRET from .env (a code works once, so a retry waits for the next step).
  const { freshCode, seedSecret } = await import(path.join(REPO, "scripts/totp.mjs"));
  const needsCode = !!(await r.json().catch(() => ({}))).mfa;
  let last;
  for (let i = 0; needsCode && i < 3; i++) {
    const { code, step } = await freshCode(seedSecret(), last); last = step;
    const m = await rq.post(`${app.api}/auth/mfa/complete`, { data: { code }, headers: { "X-CSRF-Token": csrf } });
    if (m.ok()) break;
    if (i === 2) throw new Error(`two-step sign-in failed for ${key}: ${m.status()}`);
  }
  const st = await rq.storageState();
  await rq.dispose();
  return (sessions[key] = { state: { cookies: st.cookies, origins }, token: null });
}

const sh = (cmd, args) => execFileSync(cmd, args, { cwd: REPO, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
/** SQL on the local stack's database (for tidying demo records a tutorial creates). */
export const sql = (q) => sh("docker", ["compose", "exec", "-T", "postgres", "sh", "-c", `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "${q.replace(/"/g, '\\"')}"`]);

/** Help video categories, in display order (same keys as the API's HELP_CATEGORIES). */
export const categories = [
  ["getting-started", "Getting started", "Find your way around DEL."],
  ["learning", "Learning on DEL", "The course player, notes, quizzes and certificates."],
  ["buying", "Buying and payments", "Cart, checkout, deals, receipts and refunds."],
  ["teaching", "Teaching on DEL", "For instructors: the studio, courses, sales and payouts."],
  ["account", "Your account and help", "Settings, the app on your devices, and getting support."],
];
export const inventoryFile = "docs/DEL_HELP_VIDEO_INVENTORY.md";
export const inventoryTitle = "DEL Help Video Inventory";
export const outRoot = process.env.VA_OUT || path.join(process.env.HOME, "work/videos/del-help");
