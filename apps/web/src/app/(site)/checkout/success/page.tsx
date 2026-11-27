"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { toOrder } from "@/lib/normalize";
import { moneyExact } from "@/lib/format";
import type { Order } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";

function Success() {
  const sp = useSearchParams();
  const id = sp.get("order") ?? sp.get("orderId");
  const sessionId = sp.get("session_id");
  const { refreshCart } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);
  useEffect(() => {
    if (!id) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    // The webhook usually confirms within seconds. Each round also asks the API to check the order's own Stripe
    // session (owner 2026-11-28 safety net), so a late or misrouted webhook never leaves the buyer waiting. After a
    // minute the page says so plainly and keeps checking in the background, less often.
    const tick = async () => {
      try {
        await api(`/orders/${id}/confirm`, { method: "POST", body: sessionId ? { sessionId } : {} }).catch(() => undefined);
        const o = toOrder(await api(`/orders/${id}`));
        if (stop) return;
        setOrder(o);
        if (o.status === "paid") return void refreshCart();
      } catch { /* keep the generic state */ }
      if (stop) return;
      const elapsed = Date.now() - started;
      if (elapsed > 60_000) setSlow(true);
      if (elapsed < 15 * 60_000) timer = setTimeout(() => void tick(), elapsed > 60_000 ? 10_000 : 2_000);
    };
    void tick();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [id, sessionId, refreshCart]);

  const paid = !id || order?.status === "paid";
  return (
    <div className="container-x max-w-2xl pt-16 text-center">
      {paid ? <CheckCircle2 className="mx-auto size-14 text-mint" /> : <Loader2 className="mx-auto size-12 animate-spin text-violet" />}
      <h1 className="mt-5 font-display text-[2.4rem] font-extrabold leading-tight" data-testid="checkout-success">{paid ? "You’re enrolled" : "Confirming your payment"}</h1>
      <p className="mt-3 text-lg text-ink-2">
        {paid ? "Your courses are ready in My courses, with 12 months of access from today. The receipt is in Student Studio › Purchase history." : slow ? null : "Waiting for Stripe to confirm the payment…"}
      </p>
      {!paid && slow ? (
        <p className="mx-auto mt-3 max-w-lg rounded-tile border border-line bg-surface px-4 py-3 text-ink-2" role="status" data-testid="checkout-slow">
          Your payment reached Stripe and is still being confirmed. You’ll get an email when your courses are ready, and you can check{" "}
          <Link href="/student/purchases" className="link">Purchase history</Link> at any time. This page keeps checking in the background; you can safely leave it.
        </p>
      ) : null}
      {order ? (
        <ul className="mx-auto mt-8 max-w-md divide-y divide-line rounded-tile border border-line bg-surface text-left">
          {order.lines.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="font-bold">{l.title}</span>
              {l.slug && paid ? <Link href={`/learn/${l.slug}`} className="link shrink-0 text-sm">Start learning</Link> : null}
            </li>
          ))}
          <li className="flex justify-between px-4 py-3 text-sm text-muted"><span>Total paid</span><span className="tabular-nums">{moneyExact(order.totalCents, order.currency)}</span></li>
        </ul>
      ) : null}
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/student/courses" className="btn btn-primary">Go to My courses</Link>
        <Link href="/student/purchases" className="btn btn-outline">View receipt</Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return <Suspense><Success /></Suspense>;
}
