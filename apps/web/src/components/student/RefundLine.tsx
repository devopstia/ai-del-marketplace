import Link from "next/link";
import type { CourseRefund } from "@/lib/types";
import { date } from "@/lib/format";
import { pct } from "@/lib/refund-policy-shared";

/**
 * The student's refund position for one course, without asking for a refund (owner 2026-11-26): eligibility, deadline
 * and days left, and the measured share watched against the limit. Numbers come from the API; nothing is estimated.
 */
export function RefundLine({ r, compact = false }: { r: CourseRefund | null | undefined; compact?: boolean }) {
  if (!r) return null;
  const link = <Link href={`/student/purchases/${r.orderId}`} className="link">{compact ? "Details" : "Open the receipt"}</Link>;
  const watched = <span className="tabular-nums">{pct(r.watchedPercent)} of {pct(r.maxWatchedPercent)} watched</span>;
  let text: React.ReactNode;
  let tone = "text-muted";
  if (r.state === "refunded") text = <>Refunded · {link}</>;
  else if (r.state === "requested") { text = <>Refund request in progress · {link}</>; tone = "text-amber"; }
  else if (r.state === "eligible" || r.state === "review") {
    const days = r.daysLeft === 0 ? "last day" : `${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"} left`;
    text = <>Refund available until {date(r.deadline)} (<span className="tabular-nums">{days}</span>) · {watched}{r.state === "review" ? " · a person approves" : ""} · {link}</>;
    if ((r.daysLeft ?? 99) <= 2) tone = "font-bold text-amber";
  } else {
    const late = r.reasons.includes("window_closed");
    const over = r.reasons.includes("watched_too_much");
    text = <>No standard refund: {late && over ? `the ${r.windowDays}-day period ended and over the ${pct(r.maxWatchedPercent)} limit` : late ? `the ${r.windowDays}-day period ended ${date(r.deadline)}` : over ? `over the ${pct(r.maxWatchedPercent)} limit (${pct(r.watchedPercent)} watched)` : r.reasons.includes("certificate_issued") ? "certificate issued" : "not eligible"}{compact ? null : <> · {link}</>}</>;
  }
  return <p className={`text-xs ${tone}`} data-testid="refund-line">{text}</p>;
}
