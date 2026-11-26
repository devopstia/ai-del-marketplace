"use client";
import { useEffect, useState } from "react";
import { Bell, Check, Clock, Loader2, Lock, Mail, RotateCcw, ShieldCheck, Smartphone, X } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { PageHead } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";

interface Settings {
  emailOtp: { enabled: boolean; roles: ("student" | "instructor")[]; length: number; ttlMinutes: number; maxAttempts: number; resendSeconds: number };
  session: { inactivityMinutes: number; warningMinutes: number; lifetimeHours: number; singleSession: boolean; maxConcurrent: number; terminatePrevious: boolean };
  alerts: { newDevice: boolean; suspicious: boolean };
}
interface Data { settings: Settings; saved: boolean; defaults: Settings }

const ROLES: { key: "student" | "instructor" | "admin" | "super_admin"; label: string }[] = [
  { key: "student", label: "Student" }, { key: "instructor", label: "Instructor" }, { key: "admin", label: "Admin" }, { key: "super_admin", label: "Super Admin" },
];

function Num({ id, label, hint, value, min, max, unit, onChange }: { id: string; label: string; hint?: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="min-w-0">
      <label className="label" htmlFor={id}>{label}</label>
      <div className="flex items-center gap-2">
        <input id={id} type="number" inputMode="numeric" className="field w-28 tabular-nums" min={min} max={max} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(Number(e.target.value))} />
        <span className="text-sm text-ink-2">{unit}</span>
      </div>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function Toggle({ id, label, hint, checked, onChange, disabled }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label htmlFor={id} className={`flex items-start gap-3 ${disabled ? "opacity-70" : "cursor-pointer"}`}>
      <input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--violet)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0"><span className="block font-bold text-ink">{label}</span>{hint ? <span className="block text-sm text-ink-2">{hint}</span> : null}</span>
    </label>
  );
}

const Yes = ({ label }: { label: string }) => <span className="inline-flex items-center gap-1 font-bold text-mint"><Check className="size-4" aria-hidden="true" />{label}</span>;
const No = ({ label }: { label: string }) => <span className="inline-flex items-center gap-1 text-muted"><X className="size-4" aria-hidden="true" />{label}</span>;

/**
 * Super Admin › People › Authentication & security (owner 2026-11-26, prompts.md; docs/AUTH.md §7). Saved in the
 * platform settings and applied by the API at once, without a release. Admin and Super Admin always need Google
 * Authenticator: email codes can't be switched on for them.
 */
export default function SecuritySettingsPage() {
  const toast = useToast();
  const { data, error, setData } = useApi("/admin/auth-settings", (r) => obj(r) as unknown as Data);
  const [s, setS] = useState<Settings | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the form starts from the saved settings
  useEffect(() => { if (data) setS(structuredClone(data.settings)); }, [data]);

  const changed = !!s && !!data && JSON.stringify(s) !== JSON.stringify(data.settings);
  const set = <K extends keyof Settings>(k: K, v: Partial<Settings[K]>) => setS((x) => (x ? { ...x, [k]: { ...x[k], ...v } } : x));
  const problem = !s ? null
    : s.session.warningMinutes >= s.session.inactivityMinutes ? "The warning must come before the inactivity timeout."
    : s.session.inactivityMinutes > s.session.lifetimeHours * 60 ? "The inactivity timeout can’t be longer than the session lifetime."
    : null;

  async function run(kind: "save" | "reset") {
    if (!s) return;
    setBusy(kind);
    try {
      const r = kind === "save"
        ? await api("/admin/auth-settings", { method: "PUT", body: { settings: s, code: code || undefined } })
        : await api("/admin/auth-settings/reset", { method: "POST", body: { code: code || undefined } });
      setData(obj(r) as unknown as Data);
      setCode("");
      toast("ok", kind === "save" ? "Security settings saved. They apply to every sign-in from now on." : "Recommended settings restored.");
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }

  return (
    <div className="max-w-5xl">
      <PageHead title="Authentication & security" sub="How people prove it’s them after their password, and how long they stay signed in. Changes apply at once, without a release." />
      {error ? <p className="text-rose">{error}</p> : null}
      {!s && !error ? <Skeleton className="h-[32rem]" /> : null}
      {s && data ? (
        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); void run("save"); }} data-testid="security-settings">
          <section className="rounded-panel border border-line bg-surface" aria-labelledby="methods-h">
            <div className="px-5 pt-5 sm:px-6">
              <h2 id="methods-h" className="flex items-center gap-2 font-display text-lg font-bold"><ShieldCheck className="size-5 text-violet" aria-hidden="true" />Two-step sign-in</h2>
              <p className="mt-1 text-sm text-ink-2">Every sign-in needs a second step. An email code proves access to the inbox, not who someone is, so it’s offered only to students and instructors.</p>
              <div className="mt-4"><Toggle id="email-on" label="Email codes" hint="“Send a code to my email” on the sign-in screen, for people without a smartphone or an authenticator app." checked={s.emailOtp.enabled} onChange={(v) => set("emailOtp", { enabled: v })} /></div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm" data-testid="role-methods">
                <thead className="border-y border-line bg-surface-2 text-left text-ink-2">
                  <tr><th className="px-5 py-2.5 font-bold sm:px-6">Role</th><th className="px-3 py-2.5 font-bold"><Smartphone className="mr-1 inline size-4" aria-hidden="true" />Google Authenticator</th><th className="px-3 py-2.5 font-bold"><Mail className="mr-1 inline size-4" aria-hidden="true" />Email code</th><th className="px-3 py-2.5 font-bold">Recovery codes</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {ROLES.map((r) => {
                    const privileged = r.key === "admin" || r.key === "super_admin";
                    const on = !privileged && s.emailOtp.roles.includes(r.key as "student" | "instructor");
                    return (
                      <tr key={r.key}>
                        <th scope="row" className="px-5 py-3 text-left font-bold text-ink sm:px-6">{r.label}</th>
                        <td className="px-3 py-3">{privileged ? <Yes label="Required" /> : <Yes label="Allowed" />}</td>
                        <td className="px-3 py-3">
                          {privileged ? <No label="Never (not strong enough)" /> : (
                            <label className={`inline-flex items-center gap-2 ${s.emailOtp.enabled ? "cursor-pointer" : "opacity-60"}`}>
                              <input type="checkbox" className="size-4 accent-[var(--violet)]" disabled={!s.emailOtp.enabled} checked={on} data-testid={`email-role-${r.key}`}
                                onChange={(e) => set("emailOtp", { roles: e.target.checked ? [...s.emailOtp.roles, r.key as "student" | "instructor"] : s.emailOtp.roles.filter((x) => x !== r.key) })} />
                              {on && s.emailOtp.enabled ? "Allowed" : "Off"}
                            </label>
                          )}
                        </td>
                        <td className="px-3 py-3"><Yes label="With the app" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid gap-4 border-t border-line px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
              <Num id="otp-len" label="Code length" value={s.emailOtp.length} min={6} max={8} unit="digits" onChange={(v) => set("emailOtp", { length: v })} />
              <Num id="otp-ttl" label="Code expires after" value={s.emailOtp.ttlMinutes} min={1} max={15} unit="minutes" onChange={(v) => set("emailOtp", { ttlMinutes: v })} />
              <Num id="otp-tries" label="Wrong tries per code" value={s.emailOtp.maxAttempts} min={3} max={10} unit="tries" onChange={(v) => set("emailOtp", { maxAttempts: v })} />
              <Num id="otp-resend" label="Wait before resending" value={s.emailOtp.resendSeconds} min={30} max={300} unit="seconds" onChange={(v) => set("emailOtp", { resendSeconds: v })} />
            </div>
          </section>

          <section className="rounded-panel border border-line bg-surface p-5 sm:p-6" aria-labelledby="sess-h">
            <h2 id="sess-h" className="flex items-center gap-2 font-display text-lg font-bold"><Clock className="size-5 text-violet" aria-hidden="true" />Sessions</h2>
            <p className="mt-1 text-sm text-ink-2">Stops shared accounts and forgotten open browsers. Watching a lesson counts as activity.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Num id="idle" label="Sign out after no activity for" value={s.session.inactivityMinutes} min={5} max={480} unit="minutes" onChange={(v) => set("session", { inactivityMinutes: v })} />
              <Num id="warn" label="Warn before that" value={s.session.warningMinutes} min={1} max={10} unit="minutes" hint="With a countdown and “Stay signed in”." onChange={(v) => set("session", { warningMinutes: v })} />
              <Num id="life" label="Sign in again after" value={s.session.lifetimeHours} min={1} max={720} unit="hours" hint="Even when active." onChange={(v) => set("session", { lifetimeHours: v })} />
            </div>
            <div className="mt-5 grid gap-4 border-t border-line pt-5 lg:grid-cols-2">
              <Toggle id="single" label="One signed-in browser per account" hint="Signing in on another computer, phone or browser (incognito included) ends the older session once the new one has passed every step. Tabs in the same browser keep working." checked={s.session.singleSession} onChange={(v) => set("session", { singleSession: v })} />
              <div className={s.session.singleSession ? "opacity-60" : ""}>
                <Num id="max" label="Browsers signed in at once" value={s.session.singleSession ? 1 : s.session.maxConcurrent} min={1} max={10} unit="at most" hint={s.session.singleSession ? "Turn off “one signed-in browser” to allow more." : undefined} onChange={(v) => set("session", { maxConcurrent: v })} />
              </div>
            </div>
            <fieldset className="mt-5 border-t border-line pt-5">
              <legend className="font-bold text-ink">When an account is at its limit</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex items-start gap-3 text-sm"><input type="radio" name="limit" className="mt-0.5 size-4 accent-[var(--violet)]" checked={s.session.terminatePrevious} onChange={() => set("session", { terminatePrevious: true })} /><span><span className="block font-bold text-ink">End the older session</span><span className="text-ink-2">The other browser is told it was signed in elsewhere.</span></span></label>
                <label className="flex items-start gap-3 text-sm"><input type="radio" name="limit" className="mt-0.5 size-4 accent-[var(--violet)]" checked={!s.session.terminatePrevious} onChange={() => set("session", { terminatePrevious: false })} /><span><span className="block font-bold text-ink">Refuse the new sign-in</span><span className="text-ink-2">They must sign out on the other device first.</span></span></label>
              </div>
            </fieldset>
          </section>

          <section className="rounded-panel border border-line bg-surface p-5 sm:p-6" aria-labelledby="alerts-h">
            <h2 id="alerts-h" className="flex items-center gap-2 font-display text-lg font-bold"><Bell className="size-5 text-violet" aria-hidden="true" />Security emails to the account owner</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Toggle id="newdev" label="Sign-in from a new device" hint="Date, time, device and IP address, with how to secure the account." checked={s.alerts.newDevice} onChange={(v) => set("alerts", { newDevice: v })} />
              <Toggle id="susp" label="Account locked after wrong attempts" hint="Sent when five wrong passwords or codes in a row pause sign-in for 15 minutes." checked={s.alerts.suspicious} onChange={(v) => set("alerts", { suspicious: v })} />
            </div>
          </section>

          <section className="sticky bottom-0 z-10 -mx-1 rounded-panel border border-line bg-surface/95 p-4 shadow-float backdrop-blur sm:p-5" aria-label="Save" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
            {problem ? <p role="alert" className="mb-3 text-sm font-bold text-rose">{problem}</p> : null}
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-44"><label className="label" htmlFor="sec-code"><Lock className="mr-1 inline size-3.5" aria-hidden="true" />Your authenticator code</label><input id="sec-code" className="field tabular-nums" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6 digits" data-testid="security-code" /></div>
              <button className="btn btn-primary" disabled={!!busy || !changed || !!problem || code.length < 6} data-testid="security-save">{busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}Save settings</button>
              {changed ? <button type="button" className="btn btn-ghost" onClick={() => setS(structuredClone(data.settings))}>Undo changes</button> : null}
              {data.saved ? <button type="button" className="btn btn-ghost sm:ml-auto" disabled={!!busy || code.length < 6} onClick={() => void run("reset")}>{busy === "reset" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Restore recommended settings</button> : <p className="text-sm text-muted sm:ml-auto">Using the recommended settings.</p>}
            </div>
          </section>
        </form>
      ) : null}
    </div>
  );
}
