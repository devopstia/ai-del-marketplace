"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { list, toOrder } from "@/lib/normalize";
import { date, moneyExact } from "@/lib/format";
import type { Order } from "@/lib/types";
import { Empty, Skeleton } from "@/components/Empty";
import { OrderStatus } from "@/components/StatusBadge";
import { PageHead } from "@/components/shell/AppShell";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api("/orders").then((r) => setOrders(list(r, "orders").map(toOrder))).catch((e) => setErr(errMsg(e)));
  }, []);
  return (
    <div className="max-w-[1600px]">
      <PageHead title="Purchase history" sub="Every order with its receipt. Refund requests start from a receipt." />
      {err ? <p className="mt-6 text-rose">{err}</p> : null}
      {!orders && !err ? <Skeleton className="mt-8 h-40" /> : null}
      {orders && !orders.length ? <div className="mt-8"><Empty icon={Receipt} title="No orders yet" body="Receipts for every course you buy are kept here." href="/courses" cta="Browse courses" /></div> : null}
      {orders && orders.length ? (
        <>
        {/* phones: one tappable row per order (no sideways-scrolling table) */}
        <ul className="divide-y divide-line overflow-hidden rounded-tile border border-line bg-surface sm:hidden" data-testid="orders-list">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/student/purchases/${o.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{o.lines.map((l) => l.title).join(", ") || "—"}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">{date(o.paidAt ?? o.createdAt)} · <span className="tabular-nums">{moneyExact(o.totalCents, o.currency)}</span> <OrderStatus status={o.status} /></span>
                </span>
                <span className="text-sm font-bold text-violet">Receipt</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto rounded-tile border border-line bg-surface sm:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-surface-2/60 text-muted">
              <tr><th className="px-4 py-3 font-bold">Courses</th><th className="px-4 py-3 font-bold">Date</th><th className="px-4 py-3 font-bold">Total</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3"><span className="sr-only">Receipt</span></th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3.5 font-bold">{o.lines.map((l) => l.title).join(", ") || "—"}</td>
                  <td className="px-4 py-3.5 text-ink-2">{date(o.paidAt ?? o.createdAt)}</td>
                  <td className="px-4 py-3.5 tabular-nums">{moneyExact(o.totalCents, o.currency)}</td>
                  <td className="px-4 py-3.5"><OrderStatus status={o.status} /></td>
                  <td className="px-4 py-3.5 text-right"><Link href={`/student/purchases/${o.id}`} className="link">Receipt</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : null}
    </div>
  );
}
