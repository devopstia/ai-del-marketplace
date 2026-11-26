"use client";
import { useState } from "react";
import { Copy, KeyRound, Link2, Loader2, Lock, LogOut, Mail, MailCheck, Trash2, UserCog } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { dateTime } from "@/lib/format";
import { useToast } from "@/components/Toast";

interface U { id: string; name: string; email: string; status: string; emailVerified: boolean; mfaEnabled: boolean; hasPassword: boolean }
type Busy = string | null;

/**
 * Super Admin › Users › an account: profile, account state and help signing in (owner 2026-11-26, docs/SUPER_ADMIN.md).
 * Passwords are never shown or emailed; a temporary password or recovery link is shown once, here, to hand over.
 */
export function UserAccountTools({ user: u, superAdmin, onChanged, onDeleted }: { user: U; superAdmin: boolean; onChanged: () => void; onDeleted: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<Busy>(null);
  const [name, setName] = useState(u.name);
  const [email, setEmail] = useState(u.email);
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [helpReason, setHelpReason] = useState("");
  const [secret, setSecret] = useState<{ kind: "link" | "password"; value: string; expiresAt?: string } | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [minUntil] = useState(() => new Date(Date.now() + 3600_000).toISOString().slice(0, 16));

  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key);
    try { const r = await fn(); if (ok) toast("ok", ok); onChanged(); return r; }
    catch (e) { toast("error", errMsg(e)); return null; }
    finally { setBusy(null); }
  }
  const post = (path: string, body?: unknown) => api(`/admin/people/users/${u.id}/${path}`, { method: "POST", body });
  const spin = (k: string) => (busy === k ? <Loader2 className="size-4 animate-spin" /> : null);
  const codeField = (id: string) => (
    <div><label className="label" htmlFor={id}><Lock className="mr-1 inline size-3.5" />Your authenticator code</label><input id={id} className="field tabular-nums" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6 digits" /></div>
  );

  async function copy(v: string) {
    try { await navigator.clipboard.writeText(v); toast("ok", "Copied."); } catch { toast("error", "Copy it by hand: select the text and copy."); }
  }

  return (
    <div className="space-y-6" data-testid="account-tools">
      <section aria-labelledby="profile-h">
        <h3 id="profile-h" className="flex items-center gap-2 font-display text-lg font-bold"><UserCog className="size-5 text-violet" aria-hidden="true" />Profile</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0"><label className="label" htmlFor="u-name">Name</label><input id="u-name" className="field" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <button type="button" className="btn btn-outline" disabled={!!busy || !name.trim() || name.trim() === u.name} onClick={() => void run("name", () => api(`/admin/people/users/${u.id}/profile`, { method: "PATCH", body: { name: name.trim() } }), "Name saved.")} data-testid="save-name">{spin("name")}Save name</button>
        </div>
        {superAdmin ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
            <div className="min-w-0"><label className="label" htmlFor="u-email">Email address</label><input id="u-email" type="email" className="field" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            {email.trim().toLowerCase() !== u.email ? codeField("u-email-code") : <span className="hidden sm:block" />}
            <button type="button" className="btn btn-outline" disabled={!!busy || email.trim().toLowerCase() === u.email || !email.includes("@")} onClick={() => void run("email", () => api(`/admin/people/users/${u.id}/email`, { method: "PUT", body: { email: email.trim(), code: code || undefined } }), "Email changed. They confirm the new address from the link we sent; the old address got a notice.").then((r) => r && setCode(""))} data-testid="save-email">{spin("email")}Change email</button>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="state-h">
        <h3 id="state-h" className="font-display text-lg font-bold">Account state</h3>
        {u.status === "active" ? (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="min-w-0"><label className="label" htmlFor="u-reason">Reason (required)</label><input id="u-reason" className="field" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Kept in the account history" /></div>
              <div className="min-w-0"><label className="label" htmlFor="u-until">Suspend until (optional)</label><input id="u-until" type="datetime-local" className="field" value={until} min={minUntil} onChange={(e) => setUntil(e.target.value)} /></div>
            </div>
            <p className="mt-2 text-xs text-muted">Suspending or disabling signs them out everywhere. A suspension with an end date ends by itself; a disabled account stays off until you turn it on.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn btn-danger btn-sm" disabled={!!busy || reason.trim().length < 3} onClick={() => void run("suspend", () => post("status", { status: "suspended", reason: reason.trim(), until: until ? new Date(until).toISOString() : null }), until ? "Suspended until the date you chose." : "Suspended until reactivated.").then((r) => r && setReason(""))} data-testid="suspend">{spin("suspend")}{until ? "Suspend until this date" : "Suspend"}</button>
              <button type="button" className="btn btn-outline btn-sm !text-rose" disabled={!!busy || reason.trim().length < 3} onClick={() => void run("disable", () => post("status", { status: "disabled", reason: reason.trim() }), "Account disabled.").then((r) => r && setReason(""))} data-testid="disable">{spin("disable")}Disable</button>
            </div>
          </>
        ) : (
          <div className="mt-3"><button type="button" className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => void run("activate", () => post("status", { status: "active" }), "Account reactivated.")} data-testid="reactivate">{spin("activate")}Reactivate</button></div>
        )}
      </section>

      <section aria-labelledby="help-h">
        <h3 id="help-h" className="font-display text-lg font-bold">Help signing in</h3>
        <p className="mt-1 text-sm text-ink-2">Their password is never shown to you. Confirm who they are before you hand over a link or a temporary password.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline btn-sm" disabled={!!busy || u.status !== "active"} onClick={() => void run("reset", () => post("password-reset"), `Password reset email sent to ${u.email}.`)} data-testid="send-reset">{spin("reset") ?? <Mail className="size-4" />}Send password reset email</button>
          {!u.emailVerified ? <button type="button" className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => void run("verify", () => post("verification"), `Verification email sent to ${u.email}.`)} data-testid="send-verification">{spin("verify") ?? <MailCheck className="size-4" />}Resend verification email</button> : null}
          <button type="button" className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => { if (window.confirm("Sign this person out on every device?")) void run("revoke", () => post("sessions/revoke"), "Signed out everywhere."); }} data-testid="revoke-sessions">{spin("revoke") ?? <LogOut className="size-4" />}Sign out everywhere</button>
          {superAdmin && u.mfaEnabled ? <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => { if (window.confirm("Remove this person’s authenticator? Only after confirming who they are. They set it up again at their next sign-in.")) void run("mfa", () => api(`/admin/users/${u.id}/mfa/reset`, { method: "POST" }), "Two-step sign-in reset."); }} data-testid="reset-mfa">{spin("mfa")}Reset 2-step</button> : null}
        </div>
        {superAdmin && u.status === "active" ? (
          <div className="mt-4 rounded-tile border border-line p-4">
            <p className="text-sm font-bold text-ink">When they can’t receive email</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <div className="min-w-0"><label className="label" htmlFor="help-reason">How you confirmed who they are</label><input id="help-reason" className="field" maxLength={500} value={helpReason} onChange={(e) => setHelpReason(e.target.value)} placeholder="For example: video call, ID checked" /></div>
              {codeField("help-code")}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn btn-outline btn-sm" disabled={!!busy || helpReason.trim().length < 3} onClick={() => void run("link", () => post("recovery-link", { reason: helpReason.trim(), code: code || undefined })).then((r) => { if (r) { const o = obj(r); setSecret({ kind: "link", value: String(o.link), expiresAt: String(o.expiresAt) }); setCode(""); setHelpReason(""); } })} data-testid="recovery-link">{spin("link") ?? <Link2 className="size-4" />}Create a recovery link</button>
              <button type="button" className="btn btn-outline btn-sm" disabled={!!busy || helpReason.trim().length < 3} onClick={() => { if (window.confirm("Replace their password with a temporary one? They are signed out everywhere and must choose a new password at the next sign-in.")) void run("temp", () => post("temporary-password", { reason: helpReason.trim(), code: code || undefined })).then((r) => { if (r) { setSecret({ kind: "password", value: String(obj(r).password) }); setCode(""); setHelpReason(""); } }); }} data-testid="temp-password">{spin("temp") ?? <KeyRound className="size-4" />}Set a temporary password</button>
            </div>
            {secret ? (
              <div className="mt-3 rounded-tile border border-amber bg-amber-soft p-3" role="status" data-testid="one-time-secret">
                <p className="text-sm font-bold text-amber">{secret.kind === "link" ? `Recovery link: works once, until ${dateTime(secret.expiresAt!)}.` : "Temporary password: they must change it at the next sign-in."} Shown only now.</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded bg-surface px-2 py-1.5 text-sm text-ink [overflow-wrap:anywhere]">{secret.value}</code>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => void copy(secret.value)}><Copy className="size-4" />Copy</button>
                </div>
                <button type="button" className="link mt-2 text-xs" onClick={() => setSecret(null)}>I handed it over, hide it</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {superAdmin ? (
        <section aria-labelledby="del-h" className="rounded-tile border border-rose/40 p-4">
          <h3 id="del-h" className="flex items-center gap-2 font-display text-lg font-bold text-rose"><Trash2 className="size-5" aria-hidden="true" />Delete account</h3>
          <p className="mt-1 text-sm text-ink-2">Removes their name, email, password and sign-in methods; they can never sign in again. Orders, refunds, enrolments, certificates and the audit log are kept as “Deleted user”. Instructors’ live courses must be archived first. This can’t be undone.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="min-w-0"><label className="label" htmlFor="del-reason">Reason</label><input id="del-reason" className="field" maxLength={500} value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="For example: their request" /></div>
            <div className="min-w-0"><label className="label" htmlFor="del-email">Type their email to confirm</label><input id="del-email" className="field" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} placeholder={u.email} autoComplete="off" /></div>
            {codeField("del-code")}
          </div>
          <button type="button" className="btn btn-danger btn-sm mt-3" disabled={!!busy || deleteReason.trim().length < 3 || confirmEmail.trim().toLowerCase() !== u.email} onClick={() => void run("delete", () => post("delete", { reason: deleteReason.trim(), confirmEmail: confirmEmail.trim(), code: code || undefined }), "Account deleted.").then((r) => r && onDeleted())} data-testid="delete-user">{spin("delete")}Delete this account</button>
        </section>
      ) : null}
    </div>
  );
}
