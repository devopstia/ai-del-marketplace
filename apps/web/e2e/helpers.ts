import { expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

export const PASSWORD = process.env.E2E_PASSWORD || process.env.SEED_PASSWORD || "";
export const USERS = {
  student: "student@del.example",
  instructor: "nadia@instructor.example",
  admin: "admin@del.example",
};

export async function login(page: Page, email: string, password = PASSWORD, next = "/my-learning") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
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
