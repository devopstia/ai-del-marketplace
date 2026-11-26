"use client";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * List filters kept in the page URL (shareable, survive reload and Back). Reads the current values from the query
 * string; `set` merges changes, drops empty values and replaces the history entry without scrolling.
 * Components using it must sit inside a <Suspense> boundary (useSearchParams).
 */
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const values = Object.fromEntries(keys.map((k) => [k, sp.get(k) ?? ""])) as Record<K, string>;
  const set = useCallback((patch: Partial<Record<K, string | number | null | undefined>>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch) as [string, string | number | null | undefined][]) {
      if (v === undefined || v === null || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }, [sp, router, pathname]);
  return [values, set] as const;
}
