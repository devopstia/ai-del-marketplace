import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { clock } from "@/lib/format";
import { AUDIENCE_LABEL, type HelpItem } from "@/lib/help";

/** One help video as a row: cover, title, summary, length. Used on /help and "Up next". */
export function HelpRow({ v, compact = false }: { v: HelpItem; compact?: boolean }) {
  return (
    <Link href={`/help/${v.slug}`} className="group flex gap-4 rounded-tile p-2 transition-colors hover:bg-surface-2" data-testid="help-row">
      <span className={`relative shrink-0 self-start overflow-hidden rounded-lg border border-line bg-surface-2 ${compact ? "w-32" : "w-40 sm:w-48"} aspect-video`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {v.coverUrl ? <img src={v.coverUrl} alt="" loading="lazy" className="size-full object-cover" /> : <PlayCircle className="absolute inset-0 m-auto size-8 text-muted" />}
        {v.durationSec ? <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white" data-qa-on-media>{clock(v.durationSec)}</span> : null}
      </span>
      <span className="min-w-0 py-0.5">
        <span className={`block font-bold leading-snug text-ink group-hover:text-violet ${compact ? "text-sm" : ""}`}>{v.title}</span>
        {!compact ? <span className="mt-1 line-clamp-2 block text-sm text-ink-2">{v.summary}</span> : null}
        {v.audience !== "everyone" ? <span className="mt-1.5 block text-xs font-semibold text-muted">For {AUDIENCE_LABEL[v.audience].toLowerCase()}</span> : null}
      </span>
    </Link>
  );
}
