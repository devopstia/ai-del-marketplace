"use client";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";

/** Owner 2026-11-25: while Stripe runs in test mode, learners are told plainly that no real payment happens. */
export function TestModeNotice({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { data } = useApi("/payments/mode", (r) => String(obj(r).mode ?? "off"));
  if (data !== "test" && data !== "simulated") return null;
  if (compact) {
    // Checkout (owner 2026-11-26: no large boxes): one quiet line.
    return (
      <p role="note" data-testid="test-mode" className={`flex items-center gap-2 text-sm text-ink-2 ${className}`}>
        <FlaskConical className="size-4 shrink-0 text-cyan-ink" aria-hidden="true" />
        <span><b className="text-ink">Test mode:</b> no card is charged.{data === "test" ? " Use the test card 4242 4242 4242 4242." : ""}</span>
      </p>
    );
  }
  return (
    <p role="note" data-testid="test-mode" className={`flex items-start gap-2 rounded-tile border border-line bg-surface-2 px-4 py-3 text-sm text-ink ${className}`}>
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-cyan-ink" aria-hidden="true" />
      <span><b>Test mode.</b> Payments on this site are not real yet: no card is charged and purchases are for testing only.{data === "test" ? " Use Stripe’s test card 4242 4242 4242 4242." : ""}</span>
    </p>
  );
}

/** "test" | "live" | "simulated" | "off", or null while loading. */
export function usePaymentsMode() {
  const { data } = useApi("/payments/mode", (r) => String(obj(r).mode ?? "off"));
  return data ?? null;
}

/**
 * Shown instead of Buy / Checkout while card payments are not connected (no Stripe keys yet): no button that ends
 * in an error (AGENTS.md rule 4). Learners can still enrol through DEL (manual enrollment, docs/MANUAL_ENROLLMENT.md).
 */
export function PaymentsClosed({ className = "" }: { className?: string }) {
  return (
    <div role="note" data-testid="payments-closed" className={`rounded-tile border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2 ${className}`}>
      <p className="font-bold text-ink">Online card payment opens soon.</p>
      <p className="mt-1">To enrol now, write to us and we’ll set up your access with another payment method.</p>
      <Link href="/contact?topic=payment" className="btn btn-primary btn-sm mt-3 w-full">Contact us to enrol</Link>
    </div>
  );
}
