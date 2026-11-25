"use client";
import Link from "next/link";
import { useState } from "react";
import { LifeBuoy, Mail, PlayCircle } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { clock } from "@/lib/format";
import { AUDIENCE_LABEL, toCategories, type HelpItem } from "@/lib/help";
import { Empty, Skeleton } from "@/components/Empty";

const FILTERS: [string, string][] = [["all", "Everyone"], ["students", "Students"], ["instructors", "Instructors"]];

/** One video as a card: cover on top (16:9), title, one-line summary, who it is for. */
function VideoCard({ v, big = false }: { v: HelpItem; big?: boolean }) {
  return (
    <Link href={`/help/${v.slug}`} data-testid="help-row"
      className={`group grid gap-4 rounded-panel border border-line bg-surface p-3 transition-colors hover:border-violet ${big ? "md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:items-center md:gap-7 md:p-4 xl:grid-cols-1 xl:gap-4 xl:p-3" : ""}`}>
      <span className="relative block aspect-video overflow-hidden rounded-tile border border-line bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {v.coverUrl ? <img src={v.coverUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" /> : <PlayCircle className="absolute inset-0 m-auto size-10 text-muted" />}
        <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100" data-qa-on-media>
          <span className="grid size-12 place-items-center rounded-full bg-white/95 text-[#141833] shadow-float"><PlayCircle className="size-6" /></span>
        </span>
        {v.durationSec ? <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-xs font-bold tabular-nums text-white" data-qa-on-media>{clock(v.durationSec)}</span> : null}
      </span>
      <span className="block min-w-0 px-1 pb-1">
        {big ? <span className="text-sm font-bold text-violet">Start here</span> : null}
        <span className={`block font-display font-bold leading-snug text-ink group-hover:text-violet ${big ? "mt-1 text-2xl" : "text-[1.05rem]"}`}>{v.title}</span>
        <span className={`mt-1.5 block text-ink-2 ${big ? "" : "line-clamp-2 text-sm"}`}>{v.summary}</span>
        <span className="mt-2 block text-xs font-bold text-muted">{v.audience === "everyone" ? "For everyone" : `For ${AUDIENCE_LABEL[v.audience].toLowerCase()}`}{v.durationSec ? ` · ${clock(v.durationSec)}` : ""}</span>
      </span>
    </Link>
  );
}

/** Platform videos (/help): how DEL works, recorded on the real site. Two columns: topics and filters, then videos. */
export default function PlatformVideos() {
  const { data, error } = useApi("/help/videos", toCategories);
  const [who, setWho] = useState("all");
  const fits = (v: HelpItem) => who === "all" || v.audience === "everyone" || v.audience === who;
  const cats = (data?.categories ?? []).map((c) => ({ ...c, items: c.items.filter(fits) })).filter((c) => c.items.length);
  const featured = cats[0]?.items[0];
  const total = cats.reduce((n, c) => n + c.items.length, 0);
  return (
    <div className="container-x pb-16 pt-8 md:pt-12">
      <div className="grid gap-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-14">
        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Platform videos">
          <h1 className="font-display text-[clamp(2rem,3.4vw,2.6rem)] font-extrabold leading-tight">Platform videos</h1>
          <p className="mt-2 text-ink-2">Short videos that show how DEL works, recorded on the real site. Most take two or three minutes.</p>

          {data && data.total ? (
            <>
              <p className="mt-7 text-xs font-bold uppercase tracking-[0.08em] text-muted" id="who-h">Show videos for</p>
              <div role="group" aria-labelledby="who-h" className="mt-2 flex flex-wrap gap-1.5 lg:flex-col">
                {FILTERS.map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={who === k} onClick={() => setWho(k)}
                    className={`rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors ${who === k ? "bg-violet-soft text-violet" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}>{l}</button>
                ))}
              </div>
              <p className="mt-7 hidden text-xs font-bold uppercase tracking-[0.08em] text-muted lg:block">Topics</p>
              <nav aria-label="Topics" className="mt-2 hidden lg:block">
                <ul className="space-y-0.5">
                  {cats.map((c) => (
                    <li key={c.key}><a href={`#cat-${c.key}`} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold text-ink-2 hover:bg-surface-2 hover:text-ink">{c.name}<span className="text-xs tabular-nums text-muted">{c.items.length}</span></a></li>
                  ))}
                </ul>
              </nav>
            </>
          ) : null}

          <div className="mt-8 rounded-panel border border-line bg-surface p-4">
            <p className="font-bold text-ink">Still stuck?</p>
            <p className="mt-1 text-sm text-ink-2">A person answers, usually within one working day.</p>
            <div className="mt-3 flex flex-wrap gap-2 lg:flex-col">
              <Link href="/support" className="btn btn-outline btn-sm justify-start"><LifeBuoy className="size-4" />Open a support request</Link>
              <Link href="/contact" className="btn btn-ghost btn-sm justify-start"><Mail className="size-4" />Contact us</Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          {error ? <p className="text-rose">{error}</p> : null}
          {!data && !error ? <div className="grid gap-5 sm:grid-cols-2"><Skeleton className="h-72 sm:col-span-2" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div> : null}
          {data && !data.total ? <Empty icon={PlayCircle} title="No platform videos yet" body="Our team is recording them. Meanwhile, ask us anything and we’ll reply here and by email." href="/support" cta="Contact support" /> : null}
          {cats.map((c, ci) => {
            const lead = ci === 0 ? featured : undefined;
            const items = lead ? c.items.slice(1) : c.items;
            // Columns follow the number of videos, so a row is never left with an empty slot.
            const cols = items.length % 3 === 0 || items.length > 4 ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2";
            return (
              <section key={c.key} id={`cat-${c.key}`} className={`scroll-mt-24 ${ci ? "mt-12" : ""}`} aria-labelledby={`cat-h-${c.key}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
                  <h2 id={`cat-h-${c.key}`} className="font-display text-xl font-extrabold">{c.name}</h2>
                  <p className="text-sm text-muted">{c.description}</p>
                </div>
                {lead ? (
                  <div className={`mt-5 grid gap-5 ${items.length ? "xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]" : ""}`}>
                    <VideoCard v={lead} big />
                    {items.length ? <ul className="grid content-start gap-5 sm:grid-cols-2 xl:grid-cols-1">{items.map((v) => <li key={v.slug}><VideoCard v={v} /></li>)}</ul> : null}
                  </div>
                ) : (
                  <ul className={`mt-5 grid gap-5 ${cols}`}>
                    {items.map((v) => <li key={v.slug}><VideoCard v={v} /></li>)}
                  </ul>
                )}
              </section>
            );
          })}
          {data && data.total && !total ? <p className="mt-6 text-ink-2">No videos for this group yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
