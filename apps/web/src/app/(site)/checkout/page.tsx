"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Lock, ShoppingCart } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj, toCart } from "@/lib/normalize";
import { money, moneyExact } from "@/lib/format";
import type { Cart } from "@/lib/types";
import { CourseCover } from "@/components/CourseCover";
import { Empty, Skeleton } from "@/components/Empty";

export default function CheckoutPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api("/cart").then((c) => setCart(toCart(c))).catch((e) => setErr(errMsg(e)));
  }, []);

  async function pay() {
    setBusy(true);
    setErr(null);
    try {
      const r = obj(await api("/checkout", { method: "POST" }));
      const url = String(r.url ?? "");
      if (!url) throw new Error("Checkout didn’t return a payment page. Try again.");
      window.location.assign(url);
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  }

  return (
    <div className="container-x max-w-5xl pt-10">
      <h1 className="font-display text-[2.4rem] font-extrabold">Checkout</h1>
      {!cart && !err ? <Skeleton className="mt-8 h-48" /> : null}
      {cart && !cart.items.length ? <div className="mt-8"><Empty icon={ShoppingCart} title="Nothing to check out" body="Your cart is empty. Add a course to continue." href="/courses" cta="Browse courses" /></div> : null}
      {cart && cart.items.length ? (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
          <section>
            <h2 className="font-display text-xl font-bold">Order details</h2>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {cart.items.map(({ courseId, course: c }) => (
                <li key={courseId} className="flex items-center gap-4 py-4">
                  <div className="w-24 shrink-0"><CourseCover slug={c.slug} title={c.title} thumbnailUrl={c.thumbnailUrl} size="sm" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-snug">{c.title}</p>
                    <p className="text-sm text-muted">{c.instructor.name}</p>
                  </div>
                  <span className="font-display font-extrabold tabular-nums">{money(c.priceCents, c.currency)}</span>
                </li>
              ))}
            </ul>
          </section>
          <aside className="h-fit rounded-panel border border-line bg-surface p-6">
            <h2 className="font-display text-xl font-bold">Summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-2">Courses ({cart.items.length})</dt><dd className="tabular-nums">{moneyExact(cart.totalCents, cart.currency)}</dd></div>
              <div className="flex justify-between border-t border-line pt-3 text-base font-bold"><dt>Total</dt><dd className="font-display text-xl tabular-nums">{moneyExact(cart.totalCents, cart.currency)}</dd></div>
            </dl>
            {err ? <p role="alert" className="mt-4 rounded-lg bg-rose-soft px-3 py-2 text-sm font-bold text-rose">{err}</p> : null}
            <button type="button" className="btn btn-primary mt-5 w-full" onClick={pay} disabled={busy} data-testid="pay">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}Continue to secure payment
            </button>
            <p className="mt-3 text-xs text-muted">You’ll pay on a Stripe-hosted page. By completing your purchase you agree to the terms of service.</p>
            <Link href="/cart" className="link mt-4 inline-block text-sm">Back to cart</Link>
          </aside>
        </div>
      ) : null}
      {err && !cart ? <p className="mt-6 text-rose">{err}</p> : null}
    </div>
  );
}
