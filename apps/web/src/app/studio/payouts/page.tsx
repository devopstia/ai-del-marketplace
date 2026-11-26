"use client";
import { useState } from "react";
import { BadgeCheck, CircleAlert, ExternalLink, Loader2, Building2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { moneyExact as money } from "@/lib/format";
import type { StripeStatus } from "@/lib/types";
import Link from "next/link";
import { Kpis, PageHead } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";
import { TermsNote } from "@/components/studio/TermsNote";

const map = (r: unknown): StripeStatus => {
  const o = obj(r);
  return {
    connected: Boolean(o.connected ?? o.stripeAccountId ?? o.accountId),
    payoutsEnabled: Boolean(o.payoutsEnabled),
    detailsSubmitted: Boolean(o.detailsSubmitted),
    accountId: (o.accountId ?? o.stripeAccountId) as string | null,
    isPlatform: Boolean(o.isPlatform ?? o.platform),
    stripeConfigured: o.stripeConfigured !== false,
    pendingPayoutCents: Number(o.pendingPayoutCents ?? 0) || 0,
  };
};

export default function PayoutsPage() {
  const toast = useToast();
  const { data, error } = useApi("/instructor/stripe/status", map);
  const sales = useApi("/instructor/sales", (r) => obj(obj(r).totals) as Record<string, number>);
  const manual = useApi("/enrollments/earnings", (r) => obj(obj(r).totals) as Record<string, number>);
  const t = sales.data;
  const earn = t ? { earningsCents: Number(t.earningsCents ?? 0), paidOutCents: Number(t.paidOutCents ?? 0), pendingPayoutCents: Number(t.pendingPayoutCents ?? 0), heldCents: Number(t.heldCents ?? 0), sales: Number(t.sales ?? 0), manualCents: Number(manual.data?.instructorCents ?? 0), manualPaidCents: Number(manual.data?.paidOutCents ?? 0) } : null;
  const [busy, setBusy] = useState(false);
  async function onboard() {
    setBusy(true);
    try {
      const r = obj(await api("/instructor/stripe/onboarding-link", { method: "POST" }));
      window.location.assign(String(r.url));
    } catch (e) { toast("error", errMsg(e)); setBusy(false); }
  }
  const state = !data ? null : data.isPlatform ? "platform" : !data.stripeConfigured ? "unavailable" : data.payoutsEnabled ? "ready" : data.connected ? "incomplete" : "none";
  return (
    <>
      <PageHead title="Payments & payouts" sub="Your share of each sale is transferred to your own Stripe account. Stripe handles identity checks and bank payouts; nobody at DEL ever sees your bank details." />
      {earn ? (
        <div className="mb-8 max-w-4xl"><Kpis items={[
          { label: "Earned (card sales)", value: money(earn.earningsCents), note: `${earn.sales} sale${earn.sales === 1 ? "" : "s"}, after fees and commission` },
          { label: "Paid out", value: money(earn.paidOutCents), note: "Confirmed by Stripe" },
          { label: "Pending", value: money(earn.pendingPayoutCents), note: "Inside the refund period or waiting for your Stripe setup" },
          { label: "Manual enrollments", value: money(earn.manualCents), note: earn.manualPaidCents ? `${money(earn.manualPaidCents)} paid out by DEL` : "Recorded by DEL, paid outside Stripe" },
        ]} /><p className="mt-2 text-sm text-muted">Every sale and transfer is listed in <Link href="/studio/sales" className="link">Sales</Link>.</p></div>
      ) : null}
      {error ? <p className="text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="h-56" /> : null}
      {state ? (
        <section className="grid max-w-4xl gap-8 rounded-panel border border-line bg-surface p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex gap-4">
            {state === "ready" || state === "platform" ? <BadgeCheck className="size-9 shrink-0 text-mint" /> : state === "incomplete" ? <CircleAlert className="size-9 shrink-0 text-amber" /> : <Building2 className="size-9 shrink-0 text-violet" />}
            <div>
              <h2 className="font-display text-xl font-bold">
                {state === "platform" ? "Platform-owned courses" : state === "unavailable" ? "Payouts open soon" : state === "ready" ? "Payouts are on" : state === "incomplete" ? "Finish your Stripe setup" : "Connect Stripe to get paid"}
              </h2>
              <p className="mt-1 max-w-xl text-ink-2">
                {state === "platform" ? "Your courses are sold by the platform account itself, so no transfers are needed."
                  : state === "unavailable" ? `Stripe payouts are not switched on for the marketplace yet. Your sales are recorded with your share${data?.pendingPayoutCents ? ` (${money(data.pendingPayoutCents)} so far)` : ""}, and you can connect your Stripe account here as soon as payouts open.`
                  : state === "ready" ? "Stripe has verified your account. Your share of each sale is transferred automatically after payment."
                  : state === "incomplete" ? "Stripe needs a few more details before it can pay you. Sales are recorded meanwhile and transferred once you’re verified."
                  : "Setup takes about five minutes on Stripe’s site. You’ll need your ID and bank details. We never see them."}
              </p>
              {data?.accountId ? <p className="mt-2 text-xs text-muted">Stripe account {data.accountId}</p> : null}
            </div>
          </div>
          {state !== "platform" && state !== "unavailable" ? (
            <button type="button" className={state === "ready" ? "btn btn-outline" : "btn btn-primary"} onClick={onboard} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
              {state === "ready" ? "Update details on Stripe" : state === "incomplete" ? "Continue on Stripe" : "Set up payouts with Stripe"}
            </button>
          ) : null}
        </section>
      ) : null}
      <TermsNote className="mt-6 max-w-4xl" />
      <section className="mt-10 max-w-4xl">
        <h2 className="font-display text-lg font-bold">How transfers work</h2>
        <ol className="mt-4 grid gap-6 sm:grid-cols-3">
          {[["Learner pays", "Stripe Checkout charges the learner on the platform account."], ["We split the sale", "Stripe’s processing fee comes off first; your share is your rate of what’s left. Every sale shows the numbers in Sales."], ["Stripe pays you", "16 days after the sale, when the refund period is over, your share is transferred to your Stripe account. Stripe then pays it to your bank."]].map(([t, d], i) => (
            <li key={t} className="border-t-2 border-ink pt-4"><span className="font-display text-2xl font-extrabold text-violet">{i + 1}</span><p className="mt-1 font-bold">{t}</p><p className="mt-1 text-sm text-ink-2">{d}</p></li>
          ))}
        </ol>
      </section>
    </>
  );
}
