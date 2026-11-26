"use client";
// Session security (docs/AUTH.md §7): why a session ended, and telling the sign-in page about it.

/** The API's own wording (common/session-policy.service.ts); the owner wrote the "replaced" text. */
export const ENDED_MESSAGES: Record<string, string> = {
  replaced: "Your session has ended because your account was signed in from another device or browser. If you did not authorize this login, please reset your password and contact support.",
  idle: "You were signed out after a period of inactivity. Please sign in again.",
  lifetime: "Your session reached its maximum length. Please sign in again.",
  admin: "Your session was ended by DevOps Easy Learning support. Please sign in again.",
};

export const SESSION_ENDED_EVENT = "del-session-ended";
const KEY = "del-session-ended";

/** An API answer said this browser's session ended (401 session_replaced, session_idle…). */
export function sessionEndedReason(code: string | undefined | null): string | null {
  const m = /^session_(replaced|idle|lifetime|admin)$/.exec(code ?? "");
  return m ? m[1]! : null;
}

/** Keep the reason for the sign-in page without leaving the current page (a fresh visit to a public page). */
export function rememberSessionEnded(reason: string) {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(KEY, reason); } catch { /* private mode: the query string still carries it */ }
}

/** Signed in a moment ago in this tab: SessionGuard sends the browser to the sign-in page with the reason. */
export function announceSessionEnded(reason: string) {
  if (typeof window === "undefined") return;
  rememberSessionEnded(reason);
  window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: reason }));
}

/** The sign-in page shows the reason once. */
export function takeSessionEnded(fromQuery: string | null): string | null {
  let r = fromQuery;
  try { r = r ?? sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  return r && ENDED_MESSAGES[r] ? ENDED_MESSAGES[r]! : null;
}

/** Real activity seen in this browser (any tab): typing, clicking, scrolling, a playing video. */
export const ACTIVITY_EVENT = "del-activity";
export function markActivity() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ACTIVITY_EVENT));
}
