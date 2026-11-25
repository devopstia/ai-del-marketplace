"use client";
import { FlaskConical } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";

/** Owner 2026-11-25: while Stripe runs in test mode, learners are told plainly that no real payment happens. */
export function TestModeNotice({ className = "" }: { className?: string }) {
  const { data } = useApi("/payments/mode", (r) => String(obj(r).mode ?? "off"));
  if (data !== "test" && data !== "simulated") return null;
  return (
    <p role="note" data-testid="test-mode" className={`flex items-start gap-2 rounded-tile border border-amber/50 bg-amber-soft px-4 py-3 text-sm text-ink ${className}`}>
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden="true" />
      <span><b>Test mode.</b> Payments on this site are not real yet: no card is charged and purchases are for testing only.{data === "test" ? " Use Stripe’s test card 4242 4242 4242 4242." : ""}</span>
    </p>
  );
}
