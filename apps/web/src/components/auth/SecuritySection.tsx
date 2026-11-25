"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { KeyRound, Link2, Loader2, MonitorSmartphone, ShieldCheck, Smartphone } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { date, dateTime } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Empty";
import { CodeInput, RecoveryCodes } from "./MfaStep";
import { OAUTH_ERRORS, ProviderIcon, startUrl, type Provider } from "./shared";

interface Identity { id: string; provider: string; email: string | null; createdAt: string; lastUsedAt: string | null }
interface Sec { hasPassword: boolean; passwordChangedAt: string | null; mfa: { enabledAt: string | null; recoveryCodesLeft: number }; trustedDevices: number; identities: Identity[]; providers: Provider[] }
const arr = (x: unknown) => (Array.isArray(x) ? x : []);
const toSec = (r: unknown): Sec => {
  const o = obj(r); const m = obj(o.mfa);
  return {
    hasPassword: !!o.hasPassword, passwordChangedAt: (o.passwordChangedAt as string) ?? null,
    mfa: { enabledAt: (m.enabledAt as string) ?? null, recoveryCodesLeft: Number(m.recoveryCodesLeft ?? 0) }, trustedDevices: Number(o.trustedDevices ?? 0),
    identities: arr(o.identities).map((i) => { const x = obj(i); return { id: String(x.id), provider: String(x.provider), email: (x.email as string) ?? null, createdAt: String(x.createdAt), lastUsedAt: (x.lastUsedAt as string) ?? null }; }),
    providers: arr(o.providers).map((p) => ({ key: String(obj(p).key), label: String(obj(p).label) })),
  };
};
const LABEL: Record<string, string> = { google: "Google", github: "GitHub", facebook: "Facebook", linkedin: "LinkedIn", test: "Test provider" };

/** "Enter a code to …" inline confirmation. */
function Confirm({ label, busy, onConfirm, onCancel }: { label: string; busy: boolean; onConfirm: (code: string) => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  return (
    <form className="mt-3 flex flex-wrap items-end gap-2 rounded-tile border border-line bg-surface-2 p-3" onSubmit={(e) => { e.preventDefault(); onConfirm(code); }}>
      <div className="w-44"><label className="label" htmlFor="confirm-code">Code from your app</label><CodeInput id="confirm-code" value={code} onChange={setCode} /></div>
      <button className="btn btn-primary btn-sm" disabled={busy || code.length !== 6} data-testid="confirm-submit">{busy ? <Loader2 className="size-4 animate-spin" /> : null}{label}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
    </form>
  );
}

function PasswordBox({ hasPassword, onDone }: { hasPassword: boolean; onDone: () => void }) {
  const toast = useToast();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      try {
        await api("/auth/password", { method: "POST", body: hasPassword ? { currentPassword: cur, newPassword: next } : { newPassword: next, code } });
        toast("ok", hasPassword ? "Password changed. Other devices were signed out." : "Password set. You can now also log in with your email.");
        setCur(""); setNext(""); setCode(""); onDone();
      } catch (err) { toast("error", errMsg(err)); } finally { setBusy(false); }
    }}>
      {hasPassword ? <div><label className="label" htmlFor="pw-cur">Current password</label><input id="pw-cur" type="password" autoComplete="current-password" className="field" required value={cur} onChange={(e) => setCur(e.target.value)} /></div>
        : <div><label className="label" htmlFor="pw-code">Code from your app</label><CodeInput id="pw-code" value={code} onChange={setCode} autoFocus={false} /></div>}
      <div><label className="label" htmlFor="pw-new">New password</label><input id="pw-new" type="password" autoComplete="new-password" minLength={12} maxLength={128} className="field" required value={next} onChange={(e) => setNext(e.target.value)} /><p className="hint">12+ characters, letters and numbers, not from a data breach.</p></div>
      <div className="sm:col-span-2"><button className="btn btn-outline" disabled={busy} data-testid="password-save">{busy ? <Loader2 className="size-4 animate-spin" /> : null}{hasPassword ? "Change password" : "Set password"}</button></div>
    </form>
  );
}

export function SecuritySection() {
  const sp = useSearchParams();
  const toast = useToast();
  const [sec, setSec] = useState<Sec | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [replace, setReplace] = useState<{ pending: string; secret: string; qr: string } | null>(null);
  const [newCode, setNewCode] = useState("");
  const load = useCallback(() => { api("/auth/security").then((r) => setSec(toSec(r))).catch(() => setSec(null)); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const linked = sp.get("linked"); const error = sp.get("error");
    if (linked) toast("ok", `${LABEL[linked] ?? linked} is linked. You can now log in with it.`);
    else if (error) toast("error", OAUTH_ERRORS[error] ?? "That didn’t work. Please try again.");
  }, [sp, toast]);

  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); } };
  if (!sec) return <Skeleton className="mt-10 h-72" />;
  const linkedKeys = new Set(sec.identities.map((i) => i.provider));
  const methods = sec.identities.length + (sec.hasPassword ? 1 : 0);
  const row = "flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4";

  return (
    <section id="security" className="mt-10 scroll-mt-24" aria-labelledby="security-h">
      <h2 id="security-h" className="font-display text-2xl font-extrabold">Security</h2>
      <p className="mt-1 text-ink-2">How you sign in, and the extra step that protects your account.</p>

      <div className="mt-5 divide-y divide-line rounded-tile border border-line bg-surface" data-testid="security-mfa">
        <div className={row}>
          <ShieldCheck className="size-6 text-mint" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">Two-step sign-in with Google Authenticator</p>
            <p className="text-sm text-muted">{sec.mfa.enabledAt ? `On since ${date(sec.mfa.enabledAt)}. Required for every account.` : "Set up at your next sign-in."}</p>
          </div>
          {sec.mfa.enabledAt ? <button type="button" className="btn btn-outline btn-sm" onClick={() => { setOpen(open === "replace" ? null : "replace"); setReplace(null); setNewCode(""); }}><Smartphone className="size-4" />Move to a new phone</button> : null}
        </div>
        {open === "replace" ? (
          <div className="px-5 pb-5">
            {!replace ? <Confirm label="Continue" busy={busy} onCancel={() => setOpen(null)} onConfirm={(code) => void run(async () => {
              const r = obj(await api("/auth/mfa/replace/start", { method: "POST", body: { code } }));
              setReplace({ pending: String(r.pending), secret: String(r.secret), qr: await QRCode.toString(String(r.otpauthUrl), { type: "svg", margin: 1, color: { dark: "#0c0f22", light: "#ffffff" } }) });
            })} /> : (
              <form className="mt-3 flex flex-wrap items-start gap-4 rounded-tile border border-line bg-surface-2 p-4" onSubmit={(e) => { e.preventDefault(); void run(async () => {
                await api("/auth/mfa/replace/confirm", { method: "POST", body: { pending: replace.pending, code: newCode } });
                toast("ok", "Your new phone is set up. Other devices were signed out."); setOpen(null); setReplace(null); load();
              }); }}>
                <span className="block size-36 shrink-0 overflow-hidden rounded-lg bg-white p-1.5" role="img" aria-label="QR code for your new phone" dangerouslySetInnerHTML={{ __html: replace.qr }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-2">Scan this with Google Authenticator on the new phone (or enter <span className="break-all font-mono font-bold text-ink">{replace.secret.match(/.{1,4}/g)?.join(" ")}</span>), then type the code it shows.</p>
                  <div className="mt-3 flex flex-wrap items-end gap-2"><div className="w-44"><CodeInput id="new-phone-code" value={newCode} onChange={setNewCode} /></div><button className="btn btn-primary btn-sm" disabled={busy || newCode.length !== 6}>Switch to this phone</button></div>
                </div>
              </form>
            )}
          </div>
        ) : null}
        <div className={row}>
          <KeyRound className="size-6 text-muted" />
          <div className="min-w-0 flex-1"><p className="font-bold">Recovery codes</p><p className="text-sm text-muted" data-testid="codes-left">{sec.mfa.recoveryCodesLeft} of 10 left. Use one if you lose your phone.</p></div>
          {sec.mfa.enabledAt ? <button type="button" className="btn btn-outline btn-sm" onClick={() => { setOpen(open === "codes" ? null : "codes"); setCodes(null); }} data-testid="new-codes">Get new codes</button> : null}
        </div>
        {open === "codes" ? (
          <div className="px-5 pb-5">
            {codes ? <div className="mt-3"><RecoveryCodes codes={codes} doneLabel="Done" onDone={() => { setOpen(null); setCodes(null); load(); }} /></div>
              : <Confirm label="Make new codes" busy={busy} onCancel={() => setOpen(null)} onConfirm={(code) => void run(async () => { const r = obj(await api("/auth/mfa/recovery-codes", { method: "POST", body: { code } })); setCodes(arr(r.recoveryCodes).map(String)); })} />}
            {!codes ? <p className="mt-2 text-xs text-muted">Your old codes stop working.</p> : null}
          </div>
        ) : null}
        <div className={row}>
          <MonitorSmartphone className="size-6 text-muted" />
          <div className="min-w-0 flex-1"><p className="font-bold">Trusted devices</p><p className="text-sm text-muted">{sec.trustedDevices ? `${sec.trustedDevices} device${sec.trustedDevices === 1 ? "" : "s"} skip the code for 30 days.` : "No device skips the code."}</p></div>
          {sec.trustedDevices ? <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void run(async () => { await api("/auth/trusted-devices", { method: "DELETE" }); toast("ok", "Every device will ask for a code again."); load(); })}>Forget all</button> : null}
        </div>
      </div>

      <h3 className="mt-8 font-display text-lg font-bold">Ways to log in</h3>
      <ul className="mt-3 divide-y divide-line rounded-tile border border-line bg-surface" data-testid="sign-in-methods">
        <li className={row}>
          <KeyRound className="size-5 text-muted" />
          <div className="min-w-0 flex-1"><p className="font-bold">Email and password</p><p className="text-sm text-muted">{sec.hasPassword ? (sec.passwordChangedAt ? `Last changed ${date(sec.passwordChangedAt)}` : "Set") : "Not set. Add one to also log in with your email."}</p></div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(open === "password" ? null : "password")} aria-expanded={open === "password"}>{sec.hasPassword ? "Change" : "Set a password"}</button>
          {open === "password" ? <div className="w-full"><PasswordBox hasPassword={sec.hasPassword} onDone={() => { setOpen(null); load(); }} /></div> : null}
        </li>
        {[...new Set([...sec.providers.map((p) => p.key), ...linkedKeys])].map((k) => {
          const linked = sec.identities.filter((i) => i.provider === k);
          const enabled = sec.providers.some((p) => p.key === k);
          return (
            <li key={k} className={row}>
              <ProviderIcon k={k} />
              <div className="min-w-0 flex-1">
                <p className="font-bold">{LABEL[k] ?? k}</p>
                <p className="text-sm text-muted">{linked.length ? linked.map((i) => `${i.email ?? "Linked"}${i.lastUsedAt ? `, last used ${dateTime(i.lastUsedAt)}` : ""}`).join(" · ") : "Not linked"}</p>
              </div>
              {linked.length ? linked.map((i) => (
                <button key={i.id} type="button" className="btn btn-outline btn-sm" disabled={methods <= 1} title={methods <= 1 ? "Set a password or link another account first" : undefined} onClick={() => setOpen(open === `unlink-${i.id}` ? null : `unlink-${i.id}`)} data-testid={`unlink-${k}`}>Unlink</button>
              )) : enabled ? <a href={startUrl(k, "link", "/account")} className="btn btn-outline btn-sm" data-testid={`link-${k}`}><Link2 className="size-4" />Link</a> : null}
              {linked.map((i) => open === `unlink-${i.id}` ? (
                <div key={i.id} className="w-full"><Confirm label={`Unlink ${LABEL[k] ?? k}`} busy={busy} onCancel={() => setOpen(null)} onConfirm={(code) => void run(async () => { await api(`/auth/identities/${i.id}/unlink`, { method: "POST", body: { code } }); toast("ok", `${LABEL[k] ?? k} is unlinked.`); setOpen(null); load(); })} /></div>
              ) : null)}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">Linking needs you to sign in to that account. We never join accounts just because the email address matches.</p>
    </section>
  );
}
