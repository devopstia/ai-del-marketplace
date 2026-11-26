"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { api } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { ACTIVITY_EVENT, announceSessionEnded, SESSION_ENDED_EVENT } from "@/lib/session-end";
import { useAuth } from "./AuthProvider";
import { Modal } from "./Modal";

const LAST_KEY = "del-last-activity";
const HEARTBEAT_MS = 60_000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "wheel"] as const;

interface Status { inactivityMinutes: number | null; warningMinutes: number | null }

const readLast = () => { try { return Number(localStorage.getItem(LAST_KEY)) || 0; } catch { return 0; } };
const writeLast = (t: number) => { try { localStorage.setItem(LAST_KEY, String(t)); } catch { /* private mode: this tab only */ } };

/**
 * Session security in the browser (owner 2026-11-26; docs/AUTH.md §7):
 * - real activity (typing, clicking, scrolling, a playing video) is shared across tabs and sent to the API at most once a
 *   minute, so a person working in any tab, or watching a long lesson, stays signed in;
 * - a warning with a countdown before the inactivity timeout, with "Stay signed in";
 * - when the API says the session ended (signed in elsewhere, inactivity, support), go to sign-in with the reason.
 * The API enforces all of it; this only keeps people informed.
 */
export function SessionGuard() {
  const { me, logout } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const lastBeat = useRef(0);
  const lastLocal = useRef(0);
  const ended = useRef(false);

  const toLogin = useCallback((reason: string) => {
    if (ended.current) return;
    ended.current = true;
    const here = window.location.pathname + window.location.search;
    if (window.location.pathname.startsWith("/login")) return;
    // Full navigation on purpose (AGENTS.md pitfall: no stale signed-in copies).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?ended=${encodeURIComponent(reason)}&next=${encodeURIComponent(here)}`);
  }, []);

  // Any 401 session_replaced / session_idle / … from the API.
  useEffect(() => {
    const on = (e: Event) => toLogin(String((e as CustomEvent).detail ?? ""));
    window.addEventListener(SESSION_ENDED_EVENT, on);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, on);
  }, [toLogin]);

  // This session's limits.
  useEffect(() => {
    if (!me) return;
    ended.current = false;
    api("/auth/session").then((r) => {
      const o = obj(r);
      setStatus({ inactivityMinutes: typeof o.inactivityMinutes === "number" ? o.inactivityMinutes : null, warningMinutes: typeof o.warningMinutes === "number" ? o.warningMinutes : null });
    }).catch(() => setStatus(null));
    const now = Date.now();
    lastLocal.current = now;
    writeLast(now);
  }, [me]);

  const beat = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastBeat.current < HEARTBEAT_MS) return;
    lastBeat.current = now;
    try { await api("/auth/session/heartbeat", { method: "POST" }); } catch { /* a 401 already announced the end */ }
  }, []);

  // Activity in this tab (and video playback via ACTIVITY_EVENT) → shared timestamp + throttled heartbeat.
  useEffect(() => {
    if (!me || !status?.inactivityMinutes) return;
    let lastWrite = 0;
    const on = () => {
      const now = Date.now();
      lastLocal.current = now;
      if (now - lastWrite > 5_000) { lastWrite = now; writeLast(now); }
      void beat();
    };
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, on, { passive: true });
    window.addEventListener(ACTIVITY_EVENT, on);
    return () => {
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, on);
      window.removeEventListener(ACTIVITY_EVENT, on);
    };
  }, [me, status, beat]);

  // The countdown: the newest activity from any tab decides.
  useEffect(() => {
    if (!me || !status?.inactivityMinutes) return;
    const timeoutMs = status.inactivityMinutes * 60_000;
    const warnMs = (status.warningMinutes ?? 2) * 60_000;
    const tick = () => {
      const last = Math.max(lastLocal.current, readLast());
      const remaining = last + timeoutMs - Date.now();
      if (remaining <= 0) {
        setLeft(0);
        void logout().finally(() => { announceSessionEnded("idle"); toLogin("idle"); });
        return;
      }
      setLeft(remaining <= warnMs ? Math.ceil(remaining / 1000) : null);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [me, status, logout, toLogin]);

  if (!me || !status?.inactivityMinutes || left === null || left <= 0) return null;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <Modal open onClose={() => void beat(true).then(() => { const n = Date.now(); lastLocal.current = n; writeLast(n); })} title="Are you still there?">
      <div className="p-6" data-testid="idle-warning">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 size-6 shrink-0 text-amber" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold">Are you still there?</h2>
            <p className="mt-2 text-ink-2">For your security you’ll be signed out in <span className="font-bold tabular-nums text-ink" aria-live="polite">{mm}:{ss}</span> because there was no activity.</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => void logout().then(() => window.location.assign("/login"))}>Sign out now</button>
          <button type="button" className="btn btn-primary" autoFocus data-testid="stay-signed-in" onClick={() => { const n = Date.now(); lastLocal.current = n; writeLast(n); void beat(true); setLeft(null); }}>Stay signed in</button>
        </div>
      </div>
    </Modal>
  );
}
