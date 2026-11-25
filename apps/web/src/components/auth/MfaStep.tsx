"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, KeyRound, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { api, errMsg, setCsrf } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { useAuth } from "@/components/AuthProvider";
import { ProviderIcon, safeNext } from "./shared";

interface Pending { stage: "verify" | "enroll"; method: string; name: string; email: string; next: string | null }

/** Six digits, one field (works with phone keyboards and password managers' one-time codes). */
export function CodeInput({ value, onChange, id = "mfa-code", autoFocus = true }: { value: string; onChange: (v: string) => void; id?: string; autoFocus?: boolean }) {
  return (
    <input id={id} className="field text-center font-mono text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus={autoFocus}
      value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} data-testid="mfa-code" />
  );
}

export function RecoveryCodes({ codes, onDone, doneLabel = "Continue" }: { codes: string[]; onDone: () => void; doneLabel?: string }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = `DevOps Easy Learning recovery codes\nEach code works once. Keep them somewhere other than your phone.\n\n${codes.join("\n")}\n`;
  return (
    <div data-testid="recovery-codes">
      <p className="text-ink-2">If you lose your phone, sign in with one of these codes. Each works once. Keep them somewhere other than your phone, like a password manager.</p>
      <ul className="mt-4 grid grid-cols-2 gap-2 rounded-tile border border-line bg-surface-2 p-4 font-mono text-sm sm:text-base">
        {codes.map((c) => <li key={c} className="tabular-nums">{c}</li>)}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => { void navigator.clipboard?.writeText(text).then(() => setCopied(true)); }}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Copied" : "Copy all"}</button>
        <a className="btn btn-outline btn-sm" href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`} download="del-recovery-codes.txt"><Download className="size-4" />Download</a>
      </div>
      <label className="mt-5 flex items-start gap-3 text-sm font-bold">
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--violet)]" checked={saved} onChange={(e) => setSaved(e.target.checked)} data-testid="codes-saved" />I’ve saved my recovery codes
      </label>
      <button type="button" className="btn btn-primary mt-5 w-full" disabled={!saved} onClick={onDone} data-testid="codes-continue">{doneLabel}</button>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-3">
      <span className="grid size-8 place-items-center rounded-full bg-violet-soft text-sm font-bold text-violet">{n}</span>
      <div className="min-w-0 pt-1"><p className="font-bold">{title}</p><div className="mt-2">{children}</div></div>
    </li>
  );
}

export function MfaStep() {
  const sp = useSearchParams();
  const { refresh } = useAuth();
  const [p, setP] = useState<Pending | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [trust, setTrust] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const next = safeNext(p?.next ?? sp.get("next"));

  useEffect(() => {
    api("/auth/mfa/pending").then((r) => setP(obj(r) as unknown as Pending)).catch((e) => setGone(errMsg(e)));
  }, []);
  useEffect(() => {
    if (p?.stage !== "enroll" || setup) return;
    api("/auth/mfa/enroll", { method: "POST" }).then(async (r) => {
      const o = obj(r);
      const qr = await QRCode.toString(String(o.otpauthUrl), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0c0f22", light: "#ffffff" } });
      setSetup({ secret: String(o.secret), qr });
    }).catch((e) => setErr(errMsg(e)));
  }, [p, setup]);

  async function finish() {
    await refresh();
    window.location.assign(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = obj(await api("/auth/mfa/complete", { method: "POST", body: useRecovery ? { recoveryCode: recovery, trustDevice: trust } : { code, trustDevice: trust } }));
      setCsrf(r.csrf as string | undefined);
      if (Array.isArray(r.recoveryCodes)) { setCodes(r.recoveryCodes.map(String)); setBusy(false); return; }
      await finish();
    } catch (e2) {
      const m = errMsg(e2);
      if (/sign in again|expired/i.test(m)) setGone(m); else setErr(m);
      setCode(""); setBusy(false);
    }
  }

  async function startOver() {
    await api("/auth/mfa/cancel", { method: "POST" }).catch(() => {});
    // Full navigation on purpose (AGENTS.md pitfall: no stale signed-out copies).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }

  if (gone) return (
    <div role="alert" className="rounded-tile border border-line bg-surface p-5">
      <p className="font-bold">{gone}</p>
      <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn btn-primary mt-4">Log in</Link>
    </div>
  );
  if (!p) return <div className="grid h-40 place-items-center"><Loader2 className="size-6 animate-spin text-muted" /></div>;
  if (codes) return <RecoveryCodes codes={codes} onDone={() => void finish()} />;

  const trustBox = (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" className="mt-0.5 size-4 accent-[var(--violet)]" checked={trust} onChange={(e) => setTrust(e.target.checked)} data-testid="trust-device" />
      <span><span className="font-bold">Trust this device for 30 days</span><span className="block text-muted">Only on your own computer or phone. You’ll still be asked on new devices.</span></span>
    </label>
  );
  const who = (
    <p className="mb-6 flex items-center gap-2 text-sm text-ink-2">
      {p.method !== "password" ? <ProviderIcon k={p.method} className="size-4" /> : <ShieldCheck className="size-4 text-violet" />}
      Signing in as <span className="font-bold text-ink">{p.email}</span>
    </p>
  );
  const error = err ? <p role="alert" className="rounded-tile border border-rose/40 bg-rose-soft px-4 py-3 text-sm font-bold text-rose">{err}</p> : null;

  if (p.stage === "enroll") return (
    <form onSubmit={submit} className="space-y-6">
      {who}
      {error}
      <ol className="grid gap-6">
        <Step n={1} title="Install Google Authenticator">
          <p className="text-sm text-ink-2">Free for <a className="link" href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noreferrer">iPhone</a> and <a className="link" href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noreferrer">Android</a>. Any authenticator app works.</p>
        </Step>
        <Step n={2} title="Scan this code with the app">
          {setup ? (
            <div className="flex flex-wrap items-start gap-4">
              <span className="block size-40 shrink-0 overflow-hidden rounded-lg bg-white p-1.5" role="img" aria-label="QR code to add DevOps Easy Learning to your authenticator app" data-testid="mfa-qr" dangerouslySetInnerHTML={{ __html: setup.qr }} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="text-ink-2">Can’t scan? In the app choose <span className="font-bold text-ink">Enter a setup key</span> and type:</p>
                <p className="mt-2 break-all font-mono text-base font-bold tracking-wider text-ink" data-testid="mfa-secret">{setup.secret.match(/.{1,4}/g)?.join(" ")}</p>
                <button type="button" className="btn btn-ghost btn-sm mt-1 !px-0" onClick={() => { void navigator.clipboard?.writeText(setup.secret).then(() => setCopied(true)); }}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Copied" : "Copy key"}</button>
              </div>
            </div>
          ) : <div className="grid size-40 place-items-center rounded-lg border border-line"><Loader2 className="size-6 animate-spin text-muted" /></div>}
        </Step>
        <Step n={3} title="Enter the 6-digit code it shows">
          <div className="max-w-xs"><CodeInput value={code} onChange={setCode} autoFocus={false} /></div>
        </Step>
      </ol>
      {trustBox}
      <button className="btn btn-primary w-full" disabled={busy || code.length !== 6 || !setup} data-testid="mfa-submit">{busy ? <Loader2 className="size-4 animate-spin" /> : null}Turn on and continue</button>
      <button type="button" className="btn btn-ghost w-full" onClick={() => void startOver()}>Cancel and start over</button>
    </form>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      {who}
      {error}
      {useRecovery ? (
        <div>
          <label className="label" htmlFor="recovery">Recovery code</label>
          <input id="recovery" className="field font-mono uppercase tracking-wider" autoComplete="off" required autoFocus value={recovery} onChange={(e) => setRecovery(e.target.value)} placeholder="XXXX-XXXX-XX" data-testid="recovery-code" />
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="mfa-code">Code from Google Authenticator</label>
          <CodeInput value={code} onChange={setCode} />
        </div>
      )}
      {trustBox}
      <button className="btn btn-primary w-full" disabled={busy || (useRecovery ? recovery.trim().length < 10 : code.length !== 6)} data-testid="mfa-submit">{busy ? <Loader2 className="size-4 animate-spin" /> : null}Verify</button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <button type="button" className="link inline-flex items-center gap-1.5" onClick={() => { setUseRecovery((u) => !u); setErr(null); }}>
          {useRecovery ? <><Smartphone className="size-4" />Use the app instead</> : <><KeyRound className="size-4" />Use a recovery code</>}
        </button>
        <button type="button" className="link" onClick={() => void startOver()}>Start over</button>
      </div>
      <p className="text-xs text-muted">Lost your phone and your recovery codes? <Link href="/support/new?category=account" className="link">Contact support</Link> from another signed-in device, or ask an administrator to reset your two-step sign-in.</p>
    </form>
  );
}
