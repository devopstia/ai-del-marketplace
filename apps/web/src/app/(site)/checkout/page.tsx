"use client";
import { PaymentsClosed, TestModeNotice, usePaymentsMode } from "@/components/TestModeNotice";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Lock, ShoppingCart } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj, toCart } from "@/lib/normalize";
import { moneyExact } from "@/lib/format";
import type { Cart } from "@/lib/types";
import { TERMS_VERSION } from "@/lib/terms";
import { refundRule, useRefundPolicy } from "@/lib/refund-policy";
import { Price } from "@/components/CourseViews";
import { CourseCover } from "@/components/CourseCover";
import { Empty, Skeleton } from "@/components/Empty";
import { courseBy } from "@/lib/brand";

export default function CheckoutPage() {
  const refundPolicy = useRefundPolicy();
  const payMode = usePaymentsMode();
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    api("/cart").then((c) => setCart(toCart(c))).catch((e) => setErr(errMsg(e)));
  }, []);

  async function pay() {
    setBusy(true);
    setErr(null);
    try {
      // The API records the accepted terms version, time and IP on the order; it refuses an order without them.
      const paid = (cart?.totalCents ?? 0) > 0;
      const r = obj(await api("/checkout", { method: "POST", body: { acceptTerms: consent, termsVersion: TERMS_VERSION, immediateAccessConsent: paid && consent } }));
      const url = String(r.url ?? "");
      if (!url) throw new Error("Checkout didn’t return a payment page. Try again.");
      window.location.assign(url);
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  }

  const saved = (cart?.items ?? []).reduce((n, it) => n + Math.max(0, (it.course.listPriceCents ?? it.course.priceCents) - it.course.priceCents), 0);
  return (
    <div className="container-x max-w-5xl pt-10">
      <h1 className="font-display text-[2.4rem] font-extrabold">Checkout</h1>
      <TestModeNotice className="mt-3" />
      {!cart && !err ? <Skeleton className="mt-8 h-48" /> : null}
      {cart && !cart.items.length ? <div className="mt-8"><Empty icon={ShoppingCart} title="Nothing to check out" body="Your cart is empty. Add a course to continue." href="/courses" cta="Browse courses" /></div> : null}
      {cart && cart.items.length ? (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
          <section>
            <h2 className="font-display text-xl font-bold">Order details</h2>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {cart.items.map(({ courseId, course: c }) => (
                <li key={courseId} className="flex items-center gap-4 py-4">
                  <div className="w-24 shrink-0"><CourseCover slug={c.slug} title={c.title} thumbnailUrl={c.thumbnailUrl} size="sm" showTitle={false} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-snug">{c.title}</p>
                    <p className="text-sm text-muted">{courseBy(c.instructor)}</p>
                  </div>
                  <span className="text-right tabular-nums"><Price cents={c.priceCents} listCents={c.listPriceCents} currency={c.currency} />{c.sale ? <span className="mt-0.5 block text-xs font-bold text-rose">−{c.sale.percentOff}%</span> : null}</span>
                </li>
              ))}
            </ul>
          </section>
          <aside className="h-fit rounded-panel border border-line bg-surface p-6">
            <h2 className="font-display text-xl font-bold">Summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-2">Courses ({cart.items.length})</dt><dd className="tabular-nums">{moneyExact(cart.totalCents + saved, cart.currency)}</dd></div>
              {saved > 0 ? <div className="flex justify-between text-rose"><dt>Sale discounts</dt><dd className="tabular-nums">−{moneyExact(saved, cart.currency)}</dd></div> : null}
              <div className="flex justify-between border-t border-line pt-3 text-base font-bold"><dt>Total</dt><dd className="font-display text-xl tabular-nums">{moneyExact(cart.totalCents, cart.currency)}</dd></div>
            </dl>
            {err ? <p role="alert" className="mt-4 rounded-lg bg-rose-soft px-3 py-2 text-sm font-bold text-rose">{err}</p> : null}
            {cart.totalCents > 0 ? (
              <p className="mt-5 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink-2" data-testid="access-terms">
                <span className="font-bold text-ink">12 months of access, not lifetime.</span> Each course is yours for 12 months from today. Renewing is optional and never charged automatically. Refunds: {refundRule(refundPolicy)}. <Link href="/policies/access-and-refunds" className="link">Read the policy</Link>
              </p>
            ) : null}
            {cart.totalCents > 0 && payMode === "off" ? null : (
              <label className="mt-4 flex items-start gap-2.5 text-sm text-ink-2">
                <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--violet)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="consent" />
                <span>
                  I accept the <Link href="/policies/terms" target="_blank" rel="noopener" className="link">Terms of use</Link> and
                  the <Link href="/policies/access-and-refunds" target="_blank" rel="noopener" className="link">Access and refunds policy</Link>.
                  {cart.totalCents > 0 ? " I want access right away and understand that, once I start watching, refunds follow this policy instead of the 14-day withdrawal right." : null}
                </span>
              </label>
            )}
            {cart.totalCents > 0 && payMode === "off" ? <PaymentsClosed className="mt-5" /> : (
            <button type="button" className="btn btn-primary mt-5 w-full" onClick={pay} disabled={busy || !consent} data-testid="pay">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}Continue to secure payment
            </button>)}
            <p className="mt-3 text-xs text-muted">
              You’ll pay on a Stripe-hosted page. Refunds: {refundRule(refundPolicy, true)}, and before you get its certificate.
              Request one from your order page.
            </p>
            <Link href="/cart" className="link mt-4 inline-block text-sm">Back to cart</Link>
          </aside>
        </div>
      ) : null}
      {err && !cart ? <p className="mt-6 text-rose">{err}</p> : null}
    </div>
  );
}
