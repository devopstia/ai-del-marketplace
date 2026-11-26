"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShoppingCart, Trash2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj, toCart, toCourseCard } from "@/lib/normalize";
import { guestCart, removeGuest } from "@/lib/guest-cart";
import { moneyExact, hours } from "@/lib/format";
import type { Cart } from "@/lib/types";
import { Price, SaleTag } from "@/components/CourseViews";
import { CourseCover } from "@/components/CourseCover";
import { RatingInline } from "@/components/Stars";
import { Empty, Skeleton } from "@/components/Empty";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { PaymentsClosed, TestModeNotice, usePaymentsMode } from "@/components/TestModeNotice";
import { courseBy } from "@/lib/brand";

function CanceledNotice() {
  const canceled = useSearchParams().get("canceled");
  return canceled ? <p role="status" className="mt-4 rounded-tile bg-amber-soft px-4 py-3 text-sm text-ink-2">Payment canceled. Nothing was charged and your courses are still in your cart.</p> : null;
}

export default function CartPage() {
  const { me, loading, refreshCart } = useAuth();
  const payMode = usePaymentsMode();
  const toast = useToast();
  const [cart, setCart] = useState<Cart | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Signed in: the account's cart. Guest: the course ids kept in this browser, priced by the API.
  useEffect(() => {
    if (loading) return;
    if (me) { api("/cart").then((c) => setCart(toCart(c))).catch((e) => setErr(errMsg(e))); return; }
    const ids = guestCart();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- an empty guest cart needs no request
    if (!ids.length) { setCart({ items: [], totalCents: 0, currency: "usd" }); return; }
    api("/cart/preview", { method: "POST", body: { courseIds: ids } }).then((r) => {
      const o = obj(r);
      const items = (Array.isArray(o.items) ? o.items : []).map((x) => { const c = toCourseCard(x); return { courseId: c.id, course: c }; });
      // forget courses that are no longer sold
      for (const id of (o.unavailableIds as string[]) ?? []) removeGuest(id);
      setCart({ items, totalCents: Number(o.totalCents ?? 0), currency: String(o.currency ?? "usd") });
    }).catch((e) => setErr(errMsg(e)));
  }, [me, loading]);

  async function remove(courseId: string) {
    try {
      if (!me) removeGuest(courseId);
      else await api(`/cart/${courseId}`, { method: "DELETE" });
      setCart((c) => (c ? { ...c, items: c.items.filter((i) => i.courseId !== courseId), totalCents: c.totalCents - (c.items.find((i) => i.courseId === courseId)?.course.priceCents ?? 0) } : c));
      void refreshCart();
    } catch (e) {
      toast("error", errMsg(e));
    }
  }

  // Sale savings on what is in the cart; sale prices are fixed when the order is created at checkout.
  const saved = (cart?.items ?? []).reduce((n, i) => n + Math.max(0, (i.course.listPriceCents ?? i.course.priceCents) - i.course.priceCents), 0);
  return (
    <div className="container-x max-w-6xl pt-10">
      <h1 className="font-display text-[2.4rem] font-extrabold">Shopping cart</h1>
      <Suspense><CanceledNotice /></Suspense>
      <TestModeNotice className="mt-4" compact />
      {err ? <p className="mt-6 text-rose">{err}</p> : null}
      {!cart && !err ? <div className="mt-8 space-y-4"><Skeleton className="h-28" /><Skeleton className="h-28" /></div> : null}
      {cart && !cart.items.length ? (
        <div className="mt-8"><Empty icon={ShoppingCart} title="Your cart is empty" body="Your cart is empty. Explore our courses and start learning today!" href="/courses" cta="Browse courses" /></div>
      ) : null}
      {cart && cart.items.length ? (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
          <div>
            <p className="border-b border-line pb-3 text-sm font-bold text-ink-2">{cart.items.length} {cart.items.length === 1 ? "course" : "courses"} in cart</p>
            <ul className="divide-y divide-line">
              {cart.items.map(({ courseId, course: c }) => (
                <li key={courseId} className="grid grid-cols-[96px_1fr] gap-4 py-5 sm:grid-cols-[160px_1fr_auto]" data-testid="cart-item">
                  <Link href={`/courses/${c.slug}`}><CourseCover slug={c.slug} title={c.title} thumbnailUrl={c.thumbnailUrl} size="sm" showTitle={false} /></Link>
                  <div className="min-w-0">
                    <Link href={`/courses/${c.slug}`} className="font-display font-bold leading-snug hover:text-violet">{c.title}</Link>
                    <p className="text-sm text-muted">By {courseBy(c.instructor)}</p>
                    {c.sale ? <div className="mt-1"><SaleTag sale={c.sale} withName /></div> : c.ratingCount ? <div className="mt-1"><RatingInline avg={c.ratingAvg} count={c.ratingCount} /></div> : null}
                    <p className="mt-1 text-xs text-muted">{hours(c.totalDurationSec)} total</p>
                    <div className="mt-2 flex items-center gap-4 sm:hidden">
                      <Price cents={c.priceCents} listCents={c.listPriceCents} currency={c.currency} />
                      <button type="button" className="link text-sm" onClick={() => remove(courseId)}>Remove</button>
                    </div>
                  </div>
                  <div className="hidden flex-col items-end gap-2 sm:flex">
                    <span className="text-right"><Price cents={c.priceCents} listCents={c.listPriceCents} currency={c.currency} className="text-lg" /></span>
                    <button type="button" className="btn btn-ghost btn-sm text-muted" onClick={() => remove(courseId)} aria-label={`Remove ${c.title}`}><Trash2 className="size-4" />Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <aside className="h-fit rounded-panel border border-line bg-surface p-6 lg:sticky lg:top-24">
            <p className="text-sm font-bold text-muted">Total</p>
            <p className="font-display text-4xl font-extrabold tabular-nums">{moneyExact(cart.totalCents, cart.currency)}</p>
            {saved > 0 ? (
              <p className="mt-1 text-sm"><s className="text-muted">{moneyExact(cart.totalCents + saved, cart.currency)}</s> <span className="font-bold text-rose">You save {moneyExact(saved, cart.currency)}</span></p>
            ) : null}
            {cart.totalCents > 0 && payMode === "off" ? <PaymentsClosed className="mt-5" /> : me ? <Link href="/checkout" className="btn btn-primary mt-5 w-full" data-testid="checkout">Proceed to checkout</Link> : (
              <>
                <Link href="/register?next=%2Fcheckout" className="btn btn-primary mt-5 w-full" data-testid="checkout">Proceed to checkout</Link>
                <p className="mt-2 text-center text-sm text-ink-2">New here? Create a free account in a minute. <Link href="/login?next=%2Fcheckout" className="link">I already have an account</Link></p>
              </>
            )}
            <p className="mt-3 text-xs text-muted">You’ll confirm and pay on the next step. Card details are entered on Stripe, never on this site.</p>
            <p className="mt-2 text-xs text-muted">Each course includes <span className="font-bold text-ink-2">12 months of access</span> from purchase (not lifetime). <Link href="/policies/access-and-refunds" className="link">Access and refunds</Link></p>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
