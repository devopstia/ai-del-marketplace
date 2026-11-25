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
  const { refreshCart } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);
  useEffect(() => {
    if (!id) return;
    let stop = false;
    // Stripe webhooks can land a few seconds after the redirect: poll briefly until the order is paid.
    const tick = async (n: number) => {
      try {
        const o = toOrder(await api(`/orders/${id}`));
        if (stop) return;
        setOrder(o);
        if (o.status !== "paid" && n < 10) setTimeout(() => { setTries(n + 1); void tick(n + 1); }, 1500);
      } catch { /* show generic success */ }
    };
    void tick(0);
    return () => { stop = true; };
  }, [id]);

  const paid = !id || order?.status === "paid";
  return (
    <div className="container-x max-w-2xl pt-16 text-center">
      {paid ? <CheckCircle2 className="mx-auto size-14 text-mint" /> : <Loader2 className="mx-auto size-12 animate-spin text-violet" />}
      <h1 className="mt-5 font-display text-[2.4rem] font-extrabold leading-tight" data-testid="checkout-success">{paid ? "You’re enrolled" : "Confirming your payment"}</h1>
      <p className="mt-3 text-lg text-ink-2">
        {paid ? "Your courses are ready in My learning, with 12 months of access from today. A receipt is saved under Orders." : `Waiting for Stripe to confirm the payment${tries > 6 ? ". This is taking longer than usual; you can safely leave this page." : "…"}`}
      </p>
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
        <Link href="/my-learning" className="btn btn-primary">Go to My learning</Link>
        <Link href="/orders" className="btn btn-outline">View receipt</Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return <Suspense><Success /></Suspense>;
}
