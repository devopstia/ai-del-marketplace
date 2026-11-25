"use client";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";

export type Terms = { instructorSharePercent: number; source: string; payToPlatform: boolean; holdDays: number; isPlatform: boolean; note: string | null };
export const toTerms = (r: unknown): Terms => {
  const o = obj(r);
  return { instructorSharePercent: Number(o.instructorSharePercent ?? 80), source: String(o.source ?? "default"), payToPlatform: !!o.payToPlatform, holdDays: Number(o.holdDays ?? 16), isPlatform: !!o.isPlatform, note: (o.note as string) ?? null };
};

/** One sentence that tells the instructor exactly how their money is calculated (from GET /instructor/terms). */
export function TermsNote({ className = "" }: { className?: string }) {
  const { data: t } = useApi("/instructor/terms", toTerms);
  if (!t) return null;
  const text = t.isPlatform
    ? "These are DEL’s own courses: the whole amount after Stripe’s processing fee stays with DEL, so there are no transfers."
    : t.payToPlatform
      ? `You earn ${t.instructorSharePercent}% of each sale after Stripe’s processing fee. Under your agreement this share is paid to DEL instead of a Stripe transfer.`
      : `You earn ${t.instructorSharePercent}% of each sale after Stripe’s processing fee${t.source === "agreement" ? " (your agreed rate)" : ""}. Each share is transferred ${t.holdDays} days after the sale, once the learner’s refund period has ended.`;
  return <p className={`rounded-tile border border-line bg-surface px-4 py-3 text-sm text-ink-2 ${className}`} data-testid="terms-note">{text}</p>;
}
