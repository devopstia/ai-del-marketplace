"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { api, errMsg } from "@/lib/api";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (sent) return (
    <div className="rounded-tile border border-line bg-surface p-5" role="status" data-testid="reset-sent">
      <MailCheck className="size-6 text-mint" />
      <p className="mt-3 font-bold">Check your email</p>
      <p className="mt-1 text-sm text-ink-2">If an account uses <span className="font-bold text-ink">{email}</span>, we’ve sent a link to choose a new password. It works for one hour.</p>
      <Link href="/login" className="btn btn-outline mt-5">Back to log in</Link>
    </div>
  );
  return (
    <form className="space-y-5" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      try { await api("/auth/password/forgot", { method: "POST", body: { email } }); setSent(true); } catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
    }}>
      {err ? <p role="alert" className="rounded-tile border border-rose/40 bg-rose-soft px-4 py-3 text-sm font-bold text-rose">{err}</p> : null}
      <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" className="field" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <button className="btn btn-primary w-full" disabled={busy} data-testid="forgot-submit">{busy ? <Loader2 className="size-4 animate-spin" /> : null}Send reset link</button>
      <p className="text-center text-sm text-ink-2">Remembered it? <Link href="/login" className="link">Log in</Link></p>
      <p className="text-center text-xs text-muted">Signed up with Google, GitHub, Facebook or LinkedIn? Use that button on the log-in page instead.</p>
    </form>
  );
}

export function ResetForm() {
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(token ? null : "This link is incomplete. Ask for a new one.");
  const [done, setDone] = useState(false);
  if (done) return (
    <div className="rounded-tile border border-line bg-surface p-5" role="status" data-testid="reset-done">
      <p className="font-bold">Your password is changed</p>
      <p className="mt-1 text-sm text-ink-2">You were signed out everywhere. Log in with the new password and your Google Authenticator code.</p>
      <Link href="/login" className="btn btn-primary mt-5">Log in</Link>
    </div>
  );
  return (
    <form className="space-y-5" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      try { await api("/auth/password/reset", { method: "POST", body: { token, password: pw } }); setDone(true); } catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
    }}>
      {err ? <p role="alert" className="rounded-tile border border-rose/40 bg-rose-soft px-4 py-3 text-sm font-bold text-rose">{err} {/expired|incomplete/.test(err) ? <Link href="/forgot-password" className="link">Ask for a new link</Link> : null}</p> : null}
      <div>
        <label className="label" htmlFor="new-password">New password</label>
        <div className="relative">
          <input id="new-password" type={show ? "text" : "password"} className="field pr-12" autoComplete="new-password" required minLength={12} maxLength={128} value={pw} onChange={(e) => setPw(e.target.value)} />
          <button type="button" className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-ink" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
        </div>
        <p className="hint">At least 12 characters with letters and numbers, not your email or name, and not a password from a data breach.</p>
      </div>
      <button className="btn btn-primary w-full" disabled={busy || !token} data-testid="reset-submit">{busy ? <Loader2 className="size-4 animate-spin" /> : null}Set new password</button>
    </form>
  );
}
