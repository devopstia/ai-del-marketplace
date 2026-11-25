"use client";
import Link from "next/link";
import { LifeBuoy, Plus } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { Empty, Skeleton } from "@/components/Empty";
import { StatusPill, categoryLabel, toTickets, when } from "@/components/support/shared";

export default function SupportHome() {
  const { data, error } = useApi("/support/tickets", toTickets);
  const waiting = (data ?? []).filter((t) => t.awaiting === "requester" && t.status !== "closed").length;
  return (
    <div className="container-x max-w-5xl pb-12 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="font-display text-[clamp(1.9rem,3.6vw,2.6rem)] font-extrabold leading-tight">Help and support</h1>
          <p className="mt-1 text-ink-2">Ask us anything about your account, payments, courses or the app. We reply here and by email.</p>
        </div>
        <Link href="/support/new" className="btn btn-primary" data-testid="new-ticket"><Plus className="size-4" />New request</Link>
      </div>
      {waiting ? <p className="mt-5 rounded-lg bg-amber-soft px-4 py-2.5 text-sm font-bold text-amber">{waiting === 1 ? "One request is" : `${waiting} requests are`} waiting for your answer.</p> : null}
      {error ? <p className="mt-6 text-rose">{error}</p> : null}
      {!data && !error ? <div className="mt-6 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : null}
      {data && !data.length ? (
        <div className="mt-8"><Empty icon={LifeBuoy} title="No requests yet" body="When something isn’t working or you have a question, open a request and our team will get back to you." href="/support/new" cta="Open a request" /></div>
      ) : null}
      {data && data.length ? (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-tile border border-line bg-surface" data-testid="ticket-list">
          {data.map((t) => (
            <li key={t.number}>
              <Link href={`/support/${t.number}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3.5 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{t.subject}</p>
                  <p className="truncate text-sm text-muted">{t.number} · {categoryLabel(t.category)} · updated {when(t.updatedAt)}</p>
                </div>
                <StatusPill status={t.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
