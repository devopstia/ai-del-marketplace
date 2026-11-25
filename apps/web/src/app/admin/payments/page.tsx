"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert, KeyRound, Loader2, Lock, ShieldCheck, Webhook } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { dateTime, moneyExact } from "@/lib/format";
import { PageHead } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";

interface Status {
  configured: boolean; mode: "test" | "live" | null; liveAuthorized: boolean; blockedLive: boolean; source: "dashboard" | "env"; publicMode: string;
  keys: { secretKey: string; publishableKey: string; webhookSecret: string };
  account: { id: string; name: string | null; country: string | null } | null; accountError: string | null;
  webhook: { endpoint: string; lastEventAt: string | null; lastEventType: string | null; events7d: number; secretSet: boolean };
  problems: { failedOrders7d: { id: string; createdAt: string; totalCents: number }[]; pendingOver1h: number };
  commission: { platformPercent: number; instructorPercent: number };
  devTestPayments: boolean;
}

/** Super Admin Studio › Platform › Payments & Stripe (owner 2026-11-25). Secrets go in, never come back out. */
export default function PaymentsSettings() {
  const toast = useToast();
  const { data: s, error, reload, setData } = useApi("/admin/payments/stripe", (r) => obj(r) as unknown as Status);
  const [f, setF] = useState({ secretKey: "", publishableKey: "", webhookSecret: "", code: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [live, setLive] = useState({ confirm: "", code: "" });
  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try { const r = await fn(); if (r) setData(obj(r) as unknown as Status); toast("ok", ok); } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }
  const mode = s?.mode;
  return (
    <div className="max-w-5xl">
      <PageHead title="Payments & Stripe" sub="Connection, mode and health of card payments. Keys are checked with Stripe, stored encrypted and never shown again." />
      {error ? <p className="text-rose">{error}</p> : null}
      {!s && !error ? <Skeleton className="h-72" /> : null}
      {s ? (
        <div className="space-y-6">
          <section className={`rounded-panel border p-5 sm:p-6 ${s.configured && mode === "test" ? "border-amber/50 bg-amber-soft/40" : s.configured ? "border-mint/50 bg-mint-soft/30" : "border-line bg-surface"}`} data-testid="stripe-mode">
            <div className="flex flex-wrap items-start gap-4">
              {s.configured ? (mode === "test" ? <AlertTriangle className="size-7 text-amber" /> : <CheckCircle2 className="size-7 text-mint" />) : <CircleAlert className="size-7 text-muted" />}
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl font-extrabold">{!s.configured ? (s.blockedLive ? "Live keys saved, live payments not authorised" : "Stripe is not connected") : mode === "test" ? "Test mode: no real money moves" : "Live mode: real payments"}</h2>
                <p className="mt-1 text-ink-2">{!s.configured ? (s.blockedLive ? "Checkout stays closed until you authorise live payments below." : s.devTestPayments ? "Checkout uses the built-in simulated payment (development only)." : "Checkout is closed until test keys are saved below.") : mode === "test" ? "Learners see a clear test-mode notice at the cart and checkout. Use Stripe’s test cards, for example 4242 4242 4242 4242." : "Every purchase charges a real card."}</p>
              </div>
            </div>
            <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-muted">Stripe account</dt><dd className="font-bold">{s.account ? `${s.account.name ?? "Unnamed"} (${s.account.id})` : s.accountError ? <span className="text-rose">{s.accountError}</span> : "—"}</dd></div>
              <div><dt className="text-muted">Keys from</dt><dd className="font-bold">{s.keys.secretKey ? (s.source === "dashboard" ? "This page (encrypted)" : "Server settings") : "—"}</dd></div>
              <div><dt className="text-muted">Secret key</dt><dd className="font-mono text-xs">{s.keys.secretKey || "not set"}</dd></div>
              <div><dt className="text-muted">Commission</dt><dd className="font-bold">{s.commission.instructorPercent}% instructor · {s.commission.platformPercent}% DEL (of the net)</dd></div>
            </dl>
          </section>

          <section className="rounded-panel border border-line bg-surface p-5 sm:p-6" aria-labelledby="hook-h">
            <h2 id="hook-h" className="flex items-center gap-2 font-display text-lg font-bold"><Webhook className="size-5 text-violet" />Webhook</h2>
            <dl className="mt-3 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
              <div className="sm:col-span-3"><dt className="text-muted">Endpoint to add in Stripe (Developers › Webhooks)</dt><dd className="break-all font-mono text-xs">{s.webhook.endpoint}</dd></div>
              <div><dt className="text-muted">Signing secret</dt><dd className="font-bold">{s.webhook.secretSet ? "Set" : <span className="text-amber">Missing</span>}</dd></div>
              <div><dt className="text-muted">Last event</dt><dd className="font-bold">{s.webhook.lastEventAt ? `${dateTime(s.webhook.lastEventAt)} (${s.webhook.lastEventType})` : "None received yet"}</dd></div>
              <div><dt className="text-muted">Events in 7 days</dt><dd className="font-bold tabular-nums">{s.webhook.events7d}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted">Events to send: checkout.session.completed, checkout.session.expired, payment_intent.payment_failed, charge.refunded, charge.dispute.created, charge.dispute.closed, account.updated.</p>
            {s.problems.failedOrders7d.length || s.problems.pendingOver1h ? (
              <div className="mt-4 rounded-tile bg-surface-2 px-4 py-3 text-sm">
                <p className="font-bold text-ink">Payment problems in the last 7 days</p>
                <p className="text-ink-2">{s.problems.failedOrders7d.length} failed order{s.problems.failedOrders7d.length === 1 ? "" : "s"}{s.problems.failedOrders7d[0] ? ` (latest ${dateTime(s.problems.failedOrders7d[0].createdAt)}, ${moneyExact(s.problems.failedOrders7d[0].totalCents)})` : ""} · {s.problems.pendingOver1h} checkout{s.problems.pendingOver1h === 1 ? "" : "s"} abandoned for over an hour.</p>
              </div>
            ) : <p className="mt-4 text-sm text-mint">No failed payments in the last 7 days.</p>}
          </section>

          <form className="rounded-panel border border-line bg-surface p-5 sm:p-6" aria-labelledby="keys-h" onSubmit={(e) => { e.preventDefault(); void run("save", () => api("/admin/payments/stripe", { method: "PUT", body: { ...f, code: f.code || undefined } }), "Keys checked with Stripe and saved.").then(() => setF({ secretKey: "", publishableKey: "", webhookSecret: "", code: "" })); }}>
            <h2 id="keys-h" className="flex items-center gap-2 font-display text-lg font-bold"><KeyRound className="size-5 text-violet" />Stripe keys</h2>
            <p className="mt-1 text-sm text-ink-2">From the Stripe Dashboard › Developers › API keys. Start with <b>test</b> keys (sk_test_ / pk_test_). Saving live keys does not switch on real payments: that is a separate step below.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="sk">Secret key</label><input id="sk" className="field font-mono" autoComplete="off" spellCheck={false} value={f.secretKey} onChange={(e) => setF({ ...f, secretKey: e.target.value })} placeholder="sk_test_…" /></div>
              <div><label className="label" htmlFor="pk">Publishable key</label><input id="pk" className="field font-mono" autoComplete="off" spellCheck={false} value={f.publishableKey} onChange={(e) => setF({ ...f, publishableKey: e.target.value })} placeholder="pk_test_…" /></div>
              <div><label className="label" htmlFor="wh">Webhook signing secret</label><input id="wh" className="field font-mono" autoComplete="off" spellCheck={false} value={f.webhookSecret} onChange={(e) => setF({ ...f, webhookSecret: e.target.value })} placeholder="whsec_…" /></div>
              <div><label className="label" htmlFor="code"><Lock className="mr-1 inline size-3.5" />Your authenticator code</label><input id="code" className="field tabular-nums" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, "") })} placeholder="6 digits" /></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn btn-primary" disabled={!!busy || !f.secretKey || !f.publishableKey || !f.webhookSecret} data-testid="save-stripe">{busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}Check and save</button>
              {s.source === "dashboard" ? <button type="button" className="btn btn-ghost text-rose" disabled={!!busy} onClick={() => void run("clear", () => api("/admin/payments/stripe", { method: "DELETE", body: { code: f.code || undefined } }), "Saved keys removed.")}>Remove saved keys</button> : null}
            </div>
          </form>

          <section className="rounded-panel border border-line bg-surface p-5 sm:p-6" aria-labelledby="live-h">
            <h2 id="live-h" className="font-display text-lg font-bold">Live payments</h2>
            {s.liveAuthorized ? (
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <p className="min-w-0 flex-1 text-ink-2">Live payments are authorised.</p>
                <input aria-label="Authenticator code" className="field !w-32" inputMode="numeric" maxLength={8} value={live.code} onChange={(e) => setLive({ ...live, code: e.target.value.replace(/\D/g, "") })} placeholder="Code" />
                <button type="button" className="btn btn-outline" disabled={!!busy} onClick={() => void run("live", () => api("/admin/payments/stripe/live", { method: "POST", body: { enable: false, code: live.code || undefined } }), "Live payments switched off.")}>Switch off live payments</button>
              </div>
            ) : (
              <>
                <p className="mt-1 text-sm text-ink-2">Only when DEL is ready to take real money: live keys saved above, the live webhook added, and instructors’ Stripe accounts verified. Type <b className="font-mono">ENABLE LIVE PAYMENTS</b> and your code.</p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <input aria-label="Confirmation" className="field !w-64" value={live.confirm} onChange={(e) => setLive({ ...live, confirm: e.target.value })} placeholder="ENABLE LIVE PAYMENTS" />
                  <input aria-label="Authenticator code" className="field !w-32" inputMode="numeric" maxLength={8} value={live.code} onChange={(e) => setLive({ ...live, code: e.target.value.replace(/\D/g, "") })} placeholder="Code" />
                  <button type="button" className="btn btn-danger" disabled={!!busy || mode !== "live" || live.confirm !== "ENABLE LIVE PAYMENTS"} onClick={() => void run("live", () => api("/admin/payments/stripe/live", { method: "POST", body: { enable: true, confirm: live.confirm, code: live.code || undefined } }), "Live payments are on.")}>Authorise live payments</button>
                </div>
                {mode !== "live" ? <p className="mt-2 text-xs text-muted">Disabled until live keys are saved.</p> : null}
              </>
            )}
          </section>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => reload()}>Refresh status</button>
        </div>
      ) : null}
    </div>
  );
}
