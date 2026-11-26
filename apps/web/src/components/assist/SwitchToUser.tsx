"use client";
import { useState } from "react";
import { LifeBuoy, Loader2, Lock } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { dateTime } from "@/lib/format";
import { useApi } from "@/lib/useApi";

interface Past { id: string; reason: string; startedAt: string; status: string; duration: string; actions: number; admin: { name: string } | null }

/**
 * Super Admin › Users › a user › "Switch to user dashboard" (docs/SUPPORT_SESSIONS_AND_AGENTS.md). Needs a reason and
 * the authenticator code; the person is emailed; the session ends by itself. Not for super admins or suspended accounts.
 */
export function SwitchToUser({ user }: { user: { id: string; name: string; status: string; roles: string[] } }) {
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const past = useApi(`/support-session/history?userId=${user.id}`, (r) => (obj(r).items as Past[] | undefined) ?? []);
  const blocked = user.roles.includes("super_admin") ? "Super admin dashboards can’t be opened in a support session." : user.status !== "active" ? "Reactivate the account first." : null;

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const r = obj(await api("/support-session/start", { method: "POST", body: { userId: user.id, reason: reason.trim(), code: code.trim() || undefined, minutes } }));
      window.location.assign(String(r.landing ?? "/student"));
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="assist-h" data-testid="switch-to-user">
      <h3 id="assist-h" className="font-display text-lg font-bold">Help in their dashboard</h3>
      <p className="mt-1 text-sm text-ink-2">See exactly what {user.name.split(" ")[0]} sees and work in their dashboard, without their password. They get an email with your reason. Their password, email, two-step sign-in, purchases and refunds stay off limits, and every action is recorded.</p>
      {blocked ? <p className="mt-3 text-sm font-bold text-amber">{blocked}</p> : (
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_8rem]">
          <div><label className="label" htmlFor="assist-reason">Reason (shown to them)</label><input id="assist-reason" className="field" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Can’t find the course they bought" data-testid="assist-reason" /></div>
          <div><label className="label" htmlFor="assist-code"><Lock className="mr-1 inline size-3.5" />Your code</label><input id="assist-code" className="field tabular-nums" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6 digits" data-testid="assist-code" /></div>
          <div><label className="label" htmlFor="assist-min">Up to</label><select id="assist-min" className="field" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}><option value={30}>30 min</option><option value={60}>60 min</option><option value={120}>2 hours</option></select></div>
        </div>
      )}
      {err ? <p className="mt-2 text-sm font-bold text-rose" role="alert">{err}</p> : null}
      {!blocked ? (
        <div className="mt-3 flex justify-end">
          <button type="button" className="btn btn-primary" disabled={busy || reason.trim().length < 5} onClick={() => void go()} data-testid="assist-start">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LifeBuoy className="size-4" />}Switch to user dashboard
          </button>
        </div>
      ) : null}
      {past.data?.length ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-bold text-ink-2">Earlier support sessions ({past.data.length})</summary>
          <ul className="mt-2 divide-y divide-line">
            {past.data.map((p) => (
              <li key={p.id} className="flex flex-wrap gap-x-3 py-2">
                <span className="w-36 shrink-0 text-muted">{dateTime(p.startedAt)}</span>
                <span className="min-w-0 flex-1 text-ink-2"><b className="text-ink">{p.admin?.name ?? "Super admin"}</b> · {p.duration} · {p.actions} recorded action{p.actions === 1 ? "" : "s"} · {p.status} · “{p.reason}”</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
