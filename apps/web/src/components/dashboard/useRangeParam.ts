"use client";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RANGES, type RangeKey, type RangeValue } from "./RangePicker";

/** The dashboard date range, kept in the URL (?range=30d, ?range=custom&from=…&to=…) so a view can be shared. */
export function useRangeParam(fallback: RangeKey = "30d"): [RangeValue, (v: RangeValue) => void, string] {
  const sp = useSearchParams(), router = useRouter(), path = usePathname();
  const raw = sp.get("range") as RangeKey | null;
  const value: RangeValue = raw && RANGES.some((r) => r[0] === raw) ? { range: raw, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined } : { range: fallback };
  const set = useCallback((v: RangeValue) => {
    const q = new URLSearchParams({ range: v.range, ...(v.range === "custom" && v.from && v.to ? { from: v.from, to: v.to } : {}) });
    router.replace(`${path}?${q}`, { scroll: false });
  }, [router, path]);
  const qs = new URLSearchParams({ range: value.range, ...(value.range === "custom" && value.from && value.to ? { from: value.from, to: value.to } : {}) }).toString();
  return [value, set, qs];
}
