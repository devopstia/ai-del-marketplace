"use client";
import { useState } from "react";
import { Laptop, Loader2, LogOut, Smartphone, Tablet, MonitorSmartphone } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { dateTime } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Empty";

interface Session { id: string; kind: string; createdAt: string; lastActiveAt: string; expiresAt: string; ip: string | null; device: string; deviceType: string }
interface Login { id: string; action: string; at: string; ip: string | null; device: string | null; method: string | null; mfa: string | null }
interface End { id: string; action: string; at: string; reason: string | null; byAdmin: boolean }
interface Data { sessions: Session[]; logins: Login[]; ends: End[] }

const LOGIN: Record<string, string> = { "auth.login": "Signed in", "auth.login_failed": "Wrong password", "auth.mfa_failed": "Wrong code", "auth.new_device": "New device", "auth.account_locked": "Locked after wrong attempts", "auth.email_code_sent": "Email code sent" };
const MFA: Record<string, string> = { code: "authenticator", recovery_code: "recovery code", email_code: "email code", enrolled: "set up authenticator" };
const REASON: Record<string, string> = { logout: "Signed out", replaced: "Signed in elsewhere", idle: "No activity", lifetime: "Maximum length reached", admin: "Ended by support", user: "Ended by the person", password: "Password changed", mfa_reset: "Two-step reset" };
const Icon = ({ t }: { t: string }) => (t === "phone" ? <Smartphone className="size-5" /> : t === "tablet" ? <Tablet className="size-5" /> : t === "computer" ? <Laptop className="size-5" /> : <MonitorSmartphone className="size-5" />);

/**
 * Super Admin › Users › a person: their signed-in browsers, sign-in history and session ends, and "sign out" for one or
 * all of them (docs/AUTH.md §7). Viewing is audited.
 */
export function UserSessions({ userId, self }: { userId: string; self: boolean }) {
  const toast = useToast();
  const { data, error, reload } = useApi(`/admin/users/${userId}/sessions`, (r) => obj(r) as unknown as Data);
  const [busy, setBusy] = useState<string | null>(null);
  async function end(id: string | "all") {
    setBusy(id);
    try {
      if (id === "all") await api(`/admin/users/${userId}/sessions/end-all`, { method: "POST", body: {} });
      else await api(`/admin/users/${userId}/sessions/${id}`, { method: "DELETE", body: {} });
      toast("ok", id === "all" ? "Signed out everywhere. They sign in again with their code." : "That session is signed out.");
      reload();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }
  return (
    <section aria-labelledby="sess-h" data-testid="user-sessions">
      <div className="flex flex-wrap items-center gap-3">
        <h3 id="sess-h" className="min-w-0 flex-1 font-display text-lg font-bold">Sessions</h3>
        {data && data.sessions.length && !self ? <button type="button" className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => void end("all")} data-testid="end-all-sessions">{busy === "all" ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}Sign out everywhere</button> : null}
      </div>
      {error ? <p className="mt-2 text-sm text-rose">{error}</p> : !data ? <Skeleton className="mt-3 h-24" /> : (
        <>
          {data.sessions.length ? (
            <ul className="mt-3 divide-y divide-line rounded-tile border border-line">
              {data.sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="text-ink-2"><Icon t={s.deviceType} /></span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-bold text-ink">{s.device}{s.kind === "support" ? <span className="ml-2 rounded-full bg-amber-soft px-2 py-0.5 text-xs text-amber">support session</span> : null}</p>
                    <p className="text-ink-2">Signed in {dateTime(s.createdAt)} · last active {dateTime(s.lastActiveAt)}{s.ip ? ` · IP ${s.ip}` : ""}</p>
                    <p className="text-muted">Ends by {dateTime(s.expiresAt)} at the latest</p>
                  </div>
                  {!self ? <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void end(s.id)} aria-label={`Sign out ${s.device}`}>{busy === s.id ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}Sign out</button> : null}
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted">Not signed in anywhere right now.</p>}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">Recent sign-ins</p>
              {data.logins.length ? (
                <ol className="mt-1 divide-y divide-line text-sm" data-testid="login-history">
                  {data.logins.slice(0, 12).map((l) => (
                    <li key={l.id} className="py-1.5"><span className="text-muted">{dateTime(l.at)}</span> · <b className={l.action === "auth.login" ? "text-ink" : "text-rose"}>{LOGIN[l.action] ?? l.action}</b>{l.mfa ? <span className="text-ink-2"> with {MFA[l.mfa] ?? l.mfa}</span> : null}{l.device ? <span className="text-ink-2"> · {l.device}</span> : null}{l.ip ? <span className="text-muted"> · {l.ip}</span> : null}</li>
                  ))}
                </ol>
              ) : <p className="mt-1 text-sm text-muted">No sign-ins recorded yet.</p>}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">Sessions ended</p>
              {data.ends.length ? (
                <ol className="mt-1 divide-y divide-line text-sm">
                  {data.ends.slice(0, 12).map((e) => (
                    <li key={e.id} className="py-1.5"><span className="text-muted">{dateTime(e.at)}</span> · <b className="text-ink">{REASON[e.reason ?? ""] ?? e.reason ?? "Ended"}</b>{e.byAdmin && e.reason === "admin" ? <span className="text-ink-2"> (by a super admin)</span> : null}</li>
                  ))}
                </ol>
              ) : <p className="mt-1 text-sm text-muted">None yet.</p>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
