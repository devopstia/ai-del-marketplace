"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { toOrder } from "@/lib/normalize";
import { money, moneyExact } from "@/lib/format";
import type { Order } from "@/lib/types";
import { Skeleton } from "@/components/Empty";

export function TestPayment({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/orders/${orderId}`).then((o) => setOrder(toOrder(o))).catch((e) => setErr(errMsg(e)));
  }, [orderId]);

  async function complete() {
    setBusy(true);
    setErr(null);
    try {
      await api(`/dev/test-payments/${orderId}/complete`, { method: "POST" });
      router.push(`/checkout/success?order=${orderId}`);
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  }

  return (
    <div className="container-x max-w-2xl pt-12">
      <div className="rounded-panel border-2 border-dashed border-amber bg-amber-soft/60 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <FlaskConical className="mt-1 size-7 shrink-0 text-amber" />
          <div>
            <h1 className="font-display text-2xl font-extrabold">Local test payment</h1>
            <p className="mt-2 text-ink-2">This environment has no Stripe keys, so checkout uses a development-only test payment. No card is charged and no money moves. Completing it runs the same fulfilment as a real payment: the order is marked paid and you’re enrolled.</p>
            <p className="mt-2 text-sm text-muted">This page is refused when the platform runs in production.</p>
          </div>
        </div>
      </div>
      <div className="mt-6 rounded-panel border border-line bg-surface p-6">
        {!order && !err ? <Skeleton className="h-24" /> : null}
        {order ? (
          <>
            <p className="text-sm text-muted">Order {order.id.slice(0, 8)}</p>
            <ul className="mt-3 divide-y divide-line">
              {order.lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-4 py-3"><span className="font-bold">{l.title}</span><span className="tabular-nums">{money(l.priceCents, order.currency)}</span></li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between border-t border-line pt-3 font-bold"><span>Total</span><span className="font-display text-xl tabular-nums">{moneyExact(order.totalCents, order.currency)}</span></div>
          </>
        ) : null}
        {err ? <p role="alert" className="mt-4 rounded-lg bg-rose-soft px-3 py-2 text-sm font-bold text-rose">{err}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={complete} disabled={busy || !order || order.status === "paid"} data-testid="complete-test-payment">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}Complete test payment
          </button>
          <Link href="/cart" className="btn btn-ghost">Cancel and return to cart</Link>
        </div>
        {order?.status === "paid" ? <p className="mt-3 text-sm text-mint">This order is already paid. <Link className="link" href="/student/courses">Go to My courses</Link></p> : null}
      </div>
    </div>
  );
}
