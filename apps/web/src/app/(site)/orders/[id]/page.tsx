"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { api, errMsg } from "@/lib/api";
import { toOrder } from "@/lib/normalize";
import { dateTime, moneyExact } from "@/lib/format";
import type { Order } from "@/lib/types";
import { LoopMark } from "@/components/Logo";
import { Skeleton } from "@/components/Empty";
import { OrderStatus } from "@/components/StatusBadge";
import { PrintButton } from "@/components/PrintButton";
import { useAuth } from "@/components/AuthProvider";
import { RefundPanel } from "@/components/RefundPanel";

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useAuth();
  const [o, setO] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    api(`/orders/${id}`).then((r) => setO(toOrder(r))).catch((e) => setErr(errMsg(e)));
  }, [id, n]);
  return (
    <div className="container-x max-w-3xl pt-10">
      <Link href="/orders" className="link text-sm print:hidden">All orders</Link>
      {err ? <p className="mt-6 text-rose">{err}</p> : null}
      {!o && !err ? <Skeleton className="mt-6 h-72" /> : null}
      {o ? (
        <article className="mt-4 rounded-panel border border-line bg-surface p-6 sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-2.5"><LoopMark className="h-7 w-14" /><span className="font-display font-extrabold">DevOps Easy Learning</span></div>
            <OrderStatus status={o.status} />
          </div>
          <h1 className="mt-8 font-display text-3xl font-extrabold">Receipt</h1>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <div><dt className="text-muted">Order</dt><dd className="font-bold break-all">{o.id}</dd></div>
            <div><dt className="text-muted">Date</dt><dd className="font-bold">{dateTime(o.paidAt ?? o.createdAt)}</dd></div>
            <div><dt className="text-muted">Billed to</dt><dd className="font-bold">{o.user?.name ?? me?.name}<br /><span className="font-normal text-ink-2">{o.user?.email ?? me?.email}</span></dd></div>
          </dl>
          <table className="mt-8 w-full text-sm">
            <thead className="border-b border-line text-left text-muted"><tr><th className="py-2 font-bold">Course</th><th className="py-2 text-right font-bold">Price</th></tr></thead>
            <tbody className="divide-y divide-line">
              {o.lines.map((l) => (
                <tr key={l.id}><td className="py-3"><span className="font-bold">{l.title}</span>{l.instructorName ? <span className="block text-muted">{l.instructorName}</span> : null}{l.refundedAt ? <span className="block text-rose">Refunded</span> : null}</td><td className="py-3 text-right tabular-nums">{l.listPriceCents && l.listPriceCents > l.priceCents ? <s className="mr-2 text-muted">{moneyExact(l.listPriceCents, o.currency)}</s> : null}{moneyExact(l.priceCents, o.currency)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t-2 border-ink"><td className="py-3 font-bold">Total</td><td className="py-3 text-right font-display text-xl font-extrabold tabular-nums">{moneyExact(o.totalCents, o.currency)}</td></tr></tfoot>
          </table>
          <p className="mt-8 text-xs text-muted">Payment processed by Stripe. Keep this receipt for your records.</p>
        </article>
      ) : null}
      {o && (o.status === "paid" || o.status === "partially_refunded") ? <RefundPanel orderId={o.id} onRefunded={() => setN((x) => x + 1)} /> : null}
      {o ? <div className="mt-5 flex flex-wrap items-center gap-3 print:hidden"><PrintButton /><Link href={`/support/new?order=${o.id}&from=${encodeURIComponent(`/orders/${o.id}`)}`} className="btn btn-ghost">Get help with this order</Link></div> : null}
    </div>
  );
}
