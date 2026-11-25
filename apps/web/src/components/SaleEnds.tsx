"use client";
import { useSyncExternalStore } from "react";

/** Minute ticks, so "ends in" stays right on an open page. The server renders the date instead (no clock mismatch). */
function subscribe(cb: () => void) {
  const t = setInterval(cb, 60_000);
  return () => clearInterval(t);
}
const minuteNow = () => Math.floor(Date.now() / 60_000);

export function endsLabel(endsAt: string, nowMs: number): string {
  const ms = new Date(endsAt).getTime() - nowMs;
  if (ms <= 0) return "Sale ended";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `Ends in ${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Ends in ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Ends tomorrow" : `Ends in ${d} days`;
}

const dateLabel = (endsAt: string) => `Ends ${new Date(endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;

/** "Ends in 2 days", counting down live; the exact end time is in the tooltip. */
export function SaleEnds({ endsAt, className = "" }: { endsAt: string; className?: string }) {
  const now = useSyncExternalStore(subscribe, minuteNow, () => null);
  const exact = new Date(endsAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  return (
    <time dateTime={endsAt} title={`Sale ends ${exact}`} className={className} suppressHydrationWarning>
      {now === null ? dateLabel(endsAt) : endsLabel(endsAt, now * 60_000)}
    </time>
  );
}
