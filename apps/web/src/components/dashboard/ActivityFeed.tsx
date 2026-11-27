import { dateTime } from "@/lib/format";

export interface Activity { kind: string; at: string; text: string; detail: string }
const DOT: Record<string, string> = { purchase: "bg-mint", enrolment: "bg-cyan", review: "bg-star", certificate: "bg-violet", refund: "bg-amber", course: "bg-line-strong", admin: "bg-violet", alert: "bg-rose" };

/** Compact event list, newest first: a coloured dot per kind, the event and one detail line. */
export function ActivityFeed({ items }: { items: Activity[] }) {
  return (
    <ul className="divide-y divide-line" data-testid="activity-feed">
      {items.map((a, i) => (
        <li key={`${a.kind}-${a.at}-${i}`} className="flex gap-2.5 py-2.5 text-sm first:pt-0">
          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT[a.kind] ?? "bg-muted"}`} aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate">{a.text}</p>
            <p className="text-xs text-muted">{a.detail} · {dateTime(a.at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
