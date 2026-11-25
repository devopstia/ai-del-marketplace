"use client";
import Link from "next/link";
import { useState } from "react";
import { LifeBuoy, PlayCircle } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { toCategories, type HelpItem } from "@/lib/help";
import { Empty, Skeleton } from "@/components/Empty";
import { HelpRow } from "@/components/help/HelpRow";

const FILTERS: [string, string][] = [["all", "All videos"], ["students", "For students"], ["instructors", "For instructors"]];

export default function HelpVideos() {
  const { data, error } = useApi("/help/videos", toCategories);
  const [who, setWho] = useState("all");
  const fits = (v: HelpItem) => who === "all" || v.audience === "everyone" || v.audience === who;
  const cats = (data?.categories ?? []).map((c) => ({ ...c, items: c.items.filter(fits) })).filter((c) => c.items.length);
  return (
    <div className="container-x max-w-5xl pb-14 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div className="max-w-2xl">
          <h1 className="font-display text-[clamp(1.9rem,3.6vw,2.6rem)] font-extrabold leading-tight">Help videos</h1>
          <p className="mt-1 text-ink-2">Short videos that show how DEL works, recorded on the real site. Most take two or three minutes.</p>
        </div>
        <Link href="/support" className="btn btn-ghost"><LifeBuoy className="size-4" />Contact support</Link>
      </div>

      {data && data.total ? (
        <div role="group" aria-label="Who the videos are for" className="mt-5 flex flex-wrap gap-2">
          {FILTERS.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={who === k} onClick={() => setWho(k)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors ${who === k ? "border-violet bg-violet text-on-violet" : "border-line text-ink-2 hover:border-ink-2 hover:text-ink"}`}>{l}</button>
          ))}
        </div>
      ) : null}

      {error ? <p className="mt-6 text-rose">{error}</p> : null}
      {!data && !error ? <div className="mt-8 grid gap-3 sm:grid-cols-2"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div> : null}
      {data && !data.total ? <div className="mt-8"><Empty icon={PlayCircle} title="No help videos yet" body="Our team is recording them. Meanwhile, ask us anything and we’ll reply here and by email." href="/support" cta="Contact support" /></div> : null}

      {cats.map((c) => (
        <section key={c.key} className="mt-9" aria-labelledby={`cat-${c.key}`}>
          <h2 id={`cat-${c.key}`} className="font-display text-xl font-bold">{c.name}</h2>
          <p className="mt-0.5 text-sm text-ink-2">{c.description}</p>
          <ul className="mt-3 grid gap-x-6 gap-y-1 md:grid-cols-2">
            {c.items.map((v) => <li key={v.slug}><HelpRow v={v} /></li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}
