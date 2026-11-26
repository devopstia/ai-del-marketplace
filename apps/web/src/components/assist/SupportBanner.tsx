"use client";
import { useCallback, useEffect, useState } from "react";
import { LifeBuoy, Loader2, Undo2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { useAuth } from "@/components/AuthProvider";

interface Session { reason: string; startedAt: string; expiresAt: string; subject: { name: string; email: string; roles: string[] }; returnTo: string }

const ROLE: Record<string, string> = { admin: "Admin", instructor: "Instructor", student: "Student" };
const mainRole = (roles: string[]) => (roles.includes("admin") ? "admin" : roles.includes("instructor") ? "instructor" : "student");
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Super admin support session (docs/SUPPORT_SESSIONS_AND_AGENTS.md): a bar on every page while a super admin works in
 * someone else's dashboard, with who, why, how long, and Return. Renders nothing for everyone else.
 * Fixed to the bottom so it never fights the sticky headers of the site and the studios.
 */
export function SupportBanner() {
  const { me } = useAuth();
  const [s, setS] = useState<Session | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = obj(await api("/support-session"));
      if (r.active !== true) { setS(null); return; }
      const sub = obj(r.subject);
      setS({ reason: String(r.reason ?? ""), startedAt: String(r.startedAt), expiresAt: String(r.expiresAt), returnTo: String(r.returnTo ?? "/admin"), subject: { name: String(sub.name ?? ""), email: String(sub.email ?? ""), roles: Array.isArray(sub.roles) ? sub.roles.map(String) : [] } });
    } catch {
      setS(null);
    }
  }, []);
  // Only signed-in pages can be in a support session (the subject is who /auth/me returns).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, state set when it answers
    if (me) void load();
  }, [me, load]);

  useEffect(() => {
    if (!s) { document.documentElement.style.removeProperty("--assist-bar"); return; }
    document.documentElement.style.setProperty("--assist-bar", "4.25rem");
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); document.documentElement.style.removeProperty("--assist-bar"); };
  }, [s]);

  // Time is up: the server has already stopped honouring it; go back to your own dashboard.
  const left = s ? new Date(s.expiresAt).getTime() - now : 0;
  useEffect(() => {
    if (s && left <= 0) window.location.assign("/admin");
  }, [s, left]);

  if (!s || !me) return null;
  async function back() {
    setBusy(true);
    setErr(null);
    try {
      const r = obj(await api("/support-session/end", { method: "POST" }));
      window.location.assign(String(r.returnTo ?? s!.returnTo));
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  }
  const role = ROLE[mainRole(s.subject.roles)];
  return (
    <div
      role="region"
      aria-label="Support session"
      data-testid="support-banner"
      className="fixed inset-x-0 bottom-0 z-[70] border-t-4 border-amber bg-ink text-paper shadow-float"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
        <LifeBuoy className="hidden size-5 shrink-0 text-amber sm:block" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm leading-snug">
          <p className="font-bold">
            Support session · <span data-testid="support-subject">{s.subject.name}</span>
            <span className="font-normal opacity-80"> ({s.subject.email}, {role})</span>
          </p>
          <p className="truncate opacity-80" title={s.reason}>
            <span className="tabular-nums" aria-label="Time in this session">{clock(now - new Date(s.startedAt).getTime())}</span>
            {" · ends in "}<span className="tabular-nums">{clock(left)}</span>
            {" · "}Reason: {s.reason}
          </p>
          {err ? <p className="font-bold text-amber" role="alert">{err}</p> : null}
        </div>
        <button type="button" onClick={() => void back()} disabled={busy} className="btn btn-sm shrink-0 bg-paper text-ink hover:opacity-90" data-testid="support-return">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Undo2 className="size-4" aria-hidden="true" />}Return to Super Admin
        </button>
      </div>
    </div>
  );
}
