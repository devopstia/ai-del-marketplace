"use client";
import { useState } from "react";
import { CheckCircle2, CircleDashed, Copy, ExternalLink, KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { PageHead } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";
import { ProviderIcon } from "@/components/auth/shared";

interface Item { key: string; label: string; enabled: boolean; source: "settings" | "env" | null; clientId: string; redirectUri: string; console: string; steps: string }
interface Status { site: string; items: Item[] }

/**
 * Super Admin Studio › Platform › Sign-in methods (owner 2026-11-25). Google, GitHub, Facebook and LinkedIn are
 * switched on by pasting the keys of an app created with each provider; the API checks them with the provider first.
 * A button appears on the sign-in page only while its keys are saved (AGENTS.md rule 19).
 */
export default function SignInMethods() {
  const { data: s, error, setData } = useApi("/admin/sign-in-methods", (r) => obj(r) as unknown as Status);
  return (
    <div className="max-w-5xl">
      <PageHead title="Sign-in methods" sub="Email and password always works. Each social provider appears on the sign-in page once its keys are saved here. Every method still ends with the Google Authenticator step, and every new account is a Student." />
      {error ? <p className="text-rose">{error}</p> : null}
      {!s && !error ? <Skeleton className="h-96" /> : null}
      {s ? (
        <div className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
          <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
            <KeyRound className="size-5 text-violet" />
            <div className="min-w-0 flex-1"><p className="font-bold">Email and password</p><p className="text-sm text-muted">Always on</p></div>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-mint"><CheckCircle2 className="size-4" />On</span>
          </div>
          {s.items.map((p) => <ProviderRow key={p.key} p={p} onChange={setData} />)}
        </div>
      ) : null}
    </div>
  );
}

function ProviderRow({ p, onChange }: { p: Item; onChange: (s: Status) => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ clientId: "", clientSecret: "", code: "" });
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  async function run(kind: "save" | "remove") {
    setBusy(kind);
    try {
      const r = kind === "save"
        ? await api(`/admin/sign-in-methods/${p.key}`, { method: "PUT", body: { clientId: f.clientId, clientSecret: f.clientSecret, code: f.code || undefined } })
        : await api(`/admin/sign-in-methods/${p.key}`, { method: "DELETE", body: { code: f.code || undefined } });
      onChange(obj(r) as unknown as Status);
      setF({ clientId: "", clientSecret: "", code: "" }); setOpen(false);
      toast("ok", kind === "save" ? `${p.label} keys checked and saved. The ${p.label} button is now on the sign-in page.` : `${p.label} sign-in switched off.`);
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }
  const copy = () => navigator.clipboard?.writeText(p.redirectUri).then(() => toast("ok", "Redirect URI copied"), () => toast("error", "Copy it by hand"));
  return (
    <section className="px-5 py-4 sm:px-6" aria-labelledby={`h-${p.key}`} data-testid={`provider-${p.key}`}>
      <div className="flex flex-wrap items-center gap-3">
        <ProviderIcon k={p.key} className="size-6" />
        <div className="min-w-0 flex-1">
          <h2 id={`h-${p.key}`} className="font-bold">{p.label}</h2>
          <p className="text-sm text-muted">{p.enabled ? `Client ${p.clientId} · ${p.source === "settings" ? "saved on this page (encrypted)" : "from the server settings"}` : "Not set up: no button on the sign-in page"}</p>
        </div>
        {p.enabled
          ? <span className="inline-flex items-center gap-1.5 text-sm font-bold text-mint"><CheckCircle2 className="size-4" />On</span>
          : <span className="inline-flex items-center gap-1.5 text-sm font-bold text-muted"><CircleDashed className="size-4" />Off</span>}
        <button type="button" className="btn btn-outline btn-sm" aria-expanded={open} onClick={() => setOpen(!open)} data-testid={`setup-${p.key}`}>{open ? "Close" : p.enabled ? "Replace keys" : "Set up"}</button>
      </div>
      {open ? (
        <form className="mt-4 grid gap-4 rounded-tile bg-surface-2 p-4 lg:grid-cols-[1fr_1.1fr]" onSubmit={(e) => { e.preventDefault(); void run("save"); }}>
          <div className="min-w-0 text-sm">
            <p className="font-bold text-ink">1. Create the app with {p.label}</p>
            <p className="mt-1 text-ink-2">{p.steps}</p>
            <a href={p.console} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-bold text-violet hover:underline">Open the {p.label} console<ExternalLink className="size-3.5" /></a>
            <p className="mt-4 font-bold text-ink">2. Redirect URI to register</p>
            <div className="mt-1 flex items-start gap-2">
              <code className="min-w-0 flex-1 break-all rounded-tile border border-line bg-surface px-2.5 py-1.5 text-xs">{p.redirectUri}</code>
              <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => void copy()} aria-label="Copy redirect URI"><Copy className="size-4" /></button>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">3. Paste the keys</p>
            <label className="label mt-2" htmlFor={`id-${p.key}`}>Client ID{p.key === "facebook" ? " (App ID)" : ""}</label>
            <input id={`id-${p.key}`} className="field font-mono" autoComplete="off" spellCheck={false} value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })} />
            <label className="label mt-3" htmlFor={`sec-${p.key}`}>Client secret{p.key === "facebook" ? " (App secret)" : ""}</label>
            <input id={`sec-${p.key}`} type="password" className="field font-mono" autoComplete="off" spellCheck={false} value={f.clientSecret} onChange={(e) => setF({ ...f, clientSecret: e.target.value })} />
            <label className="label mt-3" htmlFor={`code-${p.key}`}><Lock className="mr-1 inline size-3.5" />Your authenticator code</label>
            <input id={`code-${p.key}`} className="field tabular-nums" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, "") })} placeholder="6 digits" />
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn btn-primary" disabled={!!busy || !f.clientId || !f.clientSecret} data-testid={`save-${p.key}`}>{busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}Check with {p.label} and save</button>
              {p.source === "settings" ? <button type="button" className="btn btn-ghost text-rose" disabled={!!busy} onClick={() => void run("remove")}>Switch off {p.label}</button> : null}
            </div>
            <p className="mt-2 text-xs text-muted">The secret is stored encrypted and never shown again. After saving, try it: sign out and choose {p.label} on the sign-in page.</p>
          </div>
        </form>
      ) : null}
    </section>
  );
}
