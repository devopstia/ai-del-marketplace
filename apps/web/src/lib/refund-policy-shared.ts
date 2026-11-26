import { obj } from "@/lib/normalize";

/**
 * The refund policy in force (owner 2026-11-26): the numbers come from the API (Super Admin › Refunds › Policy), never
 * from the code. Pages show neutral wording until the numbers load or when the API can't be reached.
 */
export interface RefundPolicy {
  version: number;
  windowDays: number;
  maxWatchedPercent: number;
  effectiveFrom: string | null;
  selfServicePerYear: number;
  autoApprove: boolean;
  history: { version: number; windowDays: number; maxWatchedPercent: number; effectiveFrom: string; effectiveUntil: string | null }[];
}

export function toRefundPolicy(raw: unknown): RefundPolicy | null {
  const o = obj(raw);
  if (typeof o.windowDays !== "number" || typeof o.maxWatchedPercent !== "number") return null;
  const hist = Array.isArray(o.history) ? o.history : [];
  return {
    version: Number(o.version ?? 0), windowDays: o.windowDays, maxWatchedPercent: o.maxWatchedPercent,
    effectiveFrom: typeof o.effectiveFrom === "string" ? o.effectiveFrom : null, selfServicePerYear: Number(o.selfServicePerYear ?? 0), autoApprove: o.autoApprove === true,
    history: hist.map((h) => { const x = obj(h); return { version: Number(x.version), windowDays: Number(x.windowDays), maxWatchedPercent: Number(x.maxWatchedPercent), effectiveFrom: String(x.effectiveFrom ?? ""), effectiveUntil: typeof x.effectiveUntil === "string" ? x.effectiveUntil : null }; }),
  };
}

export const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/** "within 14 days if you’ve watched 25% or less" (or neutral wording while the numbers are unknown). */
export function refundRule(p: RefundPolicy | null, long = false): string {
  if (!p) return long ? "as set out in our Access and refunds policy" : "see the refund policy";
  return long ? `within ${p.windowDays} days of purchase, if you’ve watched ${pct(p.maxWatchedPercent)} of the course or less` : `within ${p.windowDays} days if you’ve watched ${pct(p.maxWatchedPercent)} or less`;
}
