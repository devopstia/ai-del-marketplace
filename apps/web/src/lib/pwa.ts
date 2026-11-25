"use client";
/**
 * Installable app (PWA) helpers: which device and browser this is, whether the app is already installed, and the browser's
 * own install prompt (Chrome, Edge, Samsung Internet, Android Firefox fire `beforeinstallprompt`; Safari never does).
 */
import { useSyncExternalStore } from "react";

export type Platform = "iphone" | "android" | "windows" | "mac" | "linux" | "chromeos" | "other";
export type Browser = "safari" | "chrome" | "edge" | "firefox" | "samsung" | "other";

export function detect(ua: string, maxTouchPoints = 0): { platform: Platform; browser: Browser } {
  const u = ua.toLowerCase();
  // iPadOS reports itself as a Mac; a Mac with a touch screen is an iPad.
  const ios = /iphone|ipad|ipod/.test(u) || (u.includes("macintosh") && maxTouchPoints > 1);
  const platform: Platform = ios ? "iphone" : u.includes("android") ? "android" : u.includes("cros") ? "chromeos" : u.includes("windows") ? "windows" : u.includes("mac os") || u.includes("macintosh") ? "mac" : u.includes("linux") ? "linux" : "other";
  const browser: Browser = u.includes("samsungbrowser") ? "samsung" : /edg(e|a|ios)?\//.test(u) ? "edge" : /firefox|fxios/.test(u) ? "firefox" : /chrome|crios|chromium/.test(u) ? "chrome" : u.includes("safari") ? "safari" : "other";
  return { platform, browser };
}

interface PromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
let deferred: PromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Called once from <PwaRegister/>: keep the browser's install prompt for our own Install button. */
export function initInstallPrompt() {
  if (typeof window === "undefined") return;
  installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as PromptEvent; emit(); });
  window.addEventListener("appinstalled", () => { deferred = null; installed = true; emit(); });
  emit();
}

/** Opens the browser's install dialog; resolves true when the person accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  emit();
  await e.prompt();
  return (await e.userChoice).outcome === "accepted";
}

type Snapshot = { canPrompt: boolean; installed: boolean };
let last: Snapshot = { canPrompt: false, installed: false };
const snapshot = () => {
  const next = { canPrompt: !!deferred, installed };
  if (next.canPrompt !== last.canPrompt || next.installed !== last.installed) last = next;
  return last;
};
const serverSnapshot: Snapshot = { canPrompt: false, installed: false };
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };

export function usePwa() {
  return useSyncExternalStore(subscribe, snapshot, () => serverSnapshot);
}
