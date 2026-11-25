const tone: Record<string, string> = {
  paid: "bg-mint-soft text-mint", published: "bg-mint-soft text-mint", approved: "bg-mint-soft text-mint", active: "bg-mint-soft text-mint", ready: "bg-mint-soft text-mint",
  pending: "bg-amber-soft text-amber", new: "bg-amber-soft text-amber", in_review: "bg-amber-soft text-amber", processing: "bg-amber-soft text-amber", uploading: "bg-amber-soft text-amber",
  changes_requested: "bg-cyan-soft text-cyan-ink", partially_refunded: "bg-cyan-soft text-cyan-ink", under_review: "bg-cyan-soft text-cyan-ink", needs_info: "bg-violet-soft text-violet",
  failed: "bg-rose-soft text-rose", rejected: "bg-rose-soft text-rose", suspended: "bg-rose-soft text-rose", refunded: "bg-surface-2 text-ink-2",
  draft: "bg-surface-2 text-ink-2", unpublished: "bg-surface-2 text-ink-2",
};
const label: Record<string, string> = {
  in_review: "In review", changes_requested: "Changes requested", partially_refunded: "Partly refunded", under_review: "Under review", needs_info: "Waiting for applicant",
};
export function StatusBadge({ status }: { status: string }) {
  const s = status || "draft";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${tone[s] ?? "bg-surface-2 text-ink-2"}`}>{label[s] ?? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ")}</span>;
}
export const OrderStatus = StatusBadge;
