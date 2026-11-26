import "server-only";
import { serverGet } from "./server-api";
import { toRefundPolicy, type RefundPolicy } from "./refund-policy-shared";

/** The refund policy in force, for server-rendered pages (null when the API can't be reached). */
export async function getRefundPolicy(): Promise<RefundPolicy | null> {
  const r = await serverGet("/refund-policy");
  return r.ok ? toRefundPolicy(r.data) : null;
}
