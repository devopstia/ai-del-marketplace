"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toRefundPolicy, type RefundPolicy } from "@/lib/refund-policy-shared";

export { pct, refundRule, toRefundPolicy, type RefundPolicy } from "@/lib/refund-policy-shared";

let cache: { at: number; value: RefundPolicy | null } | null = null;

/** Client hook: the public refund policy, fetched at most once a minute per tab. */
export function useRefundPolicy(): RefundPolicy | null {
  const [p, setP] = useState<RefundPolicy | null>(cache?.value ?? null);
  useEffect(() => {
    if (cache && Date.now() - cache.at < 60_000) return;
    let alive = true;
    api("/refund-policy").then((r) => { const v = toRefundPolicy(r); cache = { at: Date.now(), value: v }; if (alive) setP(v); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return p;
}
