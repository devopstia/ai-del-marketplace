"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LifeBuoy, Mail, PlayCircle } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { api, errMsg } from "@/lib/api";
import { clock } from "@/lib/format";
import { AUDIENCE_LABEL, SUPPORT_TOPIC, toCategories, toDetail, type HelpItem, type HelpVideoDetail } from "@/lib/help";
import { Empty, Skeleton } from "@/components/Empty";
import { VideoPlayer, type PlayerHandle } from "@/components/VideoPlayer";

const FILTERS: [string, string][] = [["all", "Everyone"], ["students", "Students"], ["instructors", "Instructors"]];

/**
 * Platform videos (/help), option B chosen for the owner (2026-11-25): it works like the course player. The playlist on
 * the left is grouped by topic and filtered by audience; the selected video plays on the right with its chapters and
 * a Next button, without leaving the page (?v=slug keeps the link shareable; /help/<slug> pages still work).
 */
export default function PlatformVideos() {
  const { data, error } = useApi("/help/videos", toCategories);
  const [who, setWho] = useState("all");
  const [slug, setSlug] = useState<string | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const fits = (v: HelpItem) => who === "all" || v.audience === "everyone" || v.audience === who;
  const cats = useMemo(() => (data?.categories ?? []).map((c) => ({ ...c, items: c.items.filter(fits) })).filter((c) => c.items.length), [data, who]); // eslint-disable-line react-hooks/exhaustive-deps
  const flat = useMemo(() => cats.flatMap((c) => c.items), [cats]);
  const totalSec = flat.reduce((n, v) => n + v.durationSec, 0);

  // First video, or the one in ?v= (shareable link).
  useEffect(() => {
    if (!flat.length || (slug && flat.some((v) => v.slug === slug))) return;
    const want = new URLSearchParams(window.location.search).get("v");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pick the starting video once the list is known
    setSlug(flat.find((v) => v.slug === want)?.slug ?? flat[0]!.slug);
  }, [flat, slug]);
  function pick(s: string) {
    setSlug(s);
    window.history.replaceState(null, "", `/help?v=${encodeURIComponent(s)}`);
    if (window.innerWidth < 1024) window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const idx = flat.findIndex((v) => v.slug === slug);
  const next = idx >= 0 ? flat[idx + 1] : undefined;
  const prev = idx > 0 ? flat[idx - 1] : undefined;

  return (
    <div className="container-x pb-16 pt-6 md:pt-10">
      {error ? <p className="text-rose">{error}</p> : null}
      {!data && !error ? <div className="grid gap-8 lg:grid-cols-[22rem_minmax(0,1fr)]"><Skeleton className="h-[34rem]" /><Skeleton className="aspect-video" /></div> : null}
      {data && !data.total ? (
        <>
          <h1 className="font-display text-[clamp(2rem,3.4vw,2.6rem)] font-extrabold">Platform videos</h1>
          <div className="mt-6"><Empty icon={PlayCircle} title="No platform videos yet" body="Our team is recording them. Meanwhile, ask us anything and we’ll reply here and by email." href="/support" cta="Contact support" /></div>
        </>
      ) : null}
      {data && data.total ? (
        <div className="grid gap-8 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-10">
          {/* playlist: below the player on phones, beside it on a laptop */}
          <aside className="order-2 lg:order-1 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1" aria-label="Playlist">
            <h1 className="font-display text-[clamp(1.8rem,3vw,2.3rem)] font-extrabold leading-tight">Platform videos</h1>
            <p className="mt-1 text-sm text-ink-2">{flat.length} short video{flat.length === 1 ? "" : "s"}, about {Math.max(1, Math.round(totalSec / 60))} minutes, recorded on the real site.</p>
            <div role="group" aria-label="Show videos for" className="mt-4 flex gap-1.5">
              {FILTERS.map(([k, l]) => (
                <button key={k} type="button" aria-pressed={who === k} onClick={() => setWho(k)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-bold transition-colors ${who === k ? "border-violet bg-violet text-on-violet" : "border-line text-ink-2 hover:border-violet hover:text-ink"}`}>{l}</button>
              ))}
            </div>
            <div className="mt-4 overflow-hidden rounded-panel border border-line bg-surface" data-testid="help-playlist">
              {cats.map((c) => {
                const isOpen = !closed.has(c.key);
                return (
                  <section key={c.key} className="border-b border-line last:border-b-0">
                    <button type="button" aria-expanded={isOpen} onClick={() => setClosed((x) => { const n = new Set(x); if (n.has(c.key)) n.delete(c.key); else n.add(c.key); return n; })}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                      <span><span className="block font-display text-[0.95rem] font-bold text-ink">{c.name}</span><span className="text-xs text-muted">{c.items.length} video{c.items.length === 1 ? "" : "s"} · {clock(c.items.reduce((n, v) => n + v.durationSec, 0))}</span></span>
                      <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${isOpen ? "" : "-rotate-90"}`} aria-hidden="true" />
                    </button>
                    {isOpen ? (
                      <ul className="pb-2">
                        {c.items.map((v) => {
                          const on = v.slug === slug;
                          return (
                            <li key={v.slug}>
                              <button type="button" onClick={() => pick(v.slug)} aria-current={on ? "true" : undefined} data-testid="help-row"
                                className={`grid w-full grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3 px-3 py-2 text-left transition-colors ${on ? "bg-violet-soft" : "hover:bg-surface-2"}`}>
                                <span className="relative block aspect-video overflow-hidden rounded-md border border-line bg-surface-2">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  {v.coverUrl ? <img src={v.coverUrl} alt="" loading="lazy" className="size-full object-cover" /> : <PlayCircle className="absolute inset-0 m-auto size-6 text-muted" />}
                                  {v.durationSec ? <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 text-[10px] font-bold tabular-nums text-white" data-qa-on-media>{clock(v.durationSec)}</span> : null}
                                </span>
                                <span className="min-w-0">
                                  <span className={`line-clamp-2 block text-sm font-bold leading-snug ${on ? "text-violet" : "text-ink"}`}>{v.title}</span>
                                  <span className="mt-0.5 block text-xs text-muted">{on ? "Playing" : v.audience === "everyone" ? "For everyone" : `For ${AUDIENCE_LABEL[v.audience].toLowerCase()}`}</span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </section>
                );
              })}
            </div>
            <div className="mt-4 rounded-panel border border-line bg-surface p-4">
              <p className="font-bold text-ink">Still stuck?</p>
              <p className="mt-1 text-sm text-ink-2">A person answers, usually within one working day.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/support" className="btn btn-outline btn-sm"><LifeBuoy className="size-4" />Support request</Link>
                <Link href="/contact" className="btn btn-ghost btn-sm"><Mail className="size-4" />Contact us</Link>
              </div>
            </div>
          </aside>
          <div className="order-1 min-w-0 lg:order-2">
            {slug ? <Watch slug={slug} next={next} prev={prev} onPick={pick} /> : <Skeleton className="aspect-video" />}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Watch({ slug, next, prev, onPick }: { slug: string; next?: HelpItem; prev?: HelpItem; onPick: (s: string) => void }) {
  const [d, setD] = useState<HelpVideoDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const player = useRef<PlayerHandle>(null);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    api(`/help/videos/${encodeURIComponent(slug)}`).then((r) => { if (live) { setD(toDetail(r)); setErr(null); setNow(0); } }).catch((e) => live && setErr(errMsg(e)));
    return () => { live = false; };
  }, [slug]);
  const current = d ? [...d.chapters].reverse().find((c) => now >= c.t - 0.25) : undefined;
  const jump = (t: number) => { const v = player.current?.video; if (v) { v.currentTime = t; void v.play().catch(() => {}); } };
  return (
    <div data-testid="help-watch">
      <div ref={stage} className="player-stage">
        {d && d.slug === slug ? (
          <VideoPlayer ref={player} key={d.playback.url} src={d.playback.url} format={d.playback.format} captionsUrl={d.playback.captionsUrl} title={d.title} autoPlay={false}
            fullscreenRef={stage} onTime={setNow}
            onNext={next ? () => onPick(next.slug) : undefined} nextTitle={next?.title}
            onPrev={prev ? () => onPick(prev.slug) : undefined} prevTitle={prev?.title} />
        ) : err ? <div className="grid aspect-video place-items-center rounded-tile border border-line bg-surface p-6 text-center text-ink-2">{err}</div> : <Skeleton className="aspect-video" />}
      </div>
      {d ? (
        <>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-3xl">
              <p className="text-sm font-bold text-violet">{d.categoryName}</p>
              <h2 className="mt-1 font-display text-[clamp(1.4rem,2.4vw,1.9rem)] font-extrabold leading-tight">{d.title}</h2>
              <p className="mt-2 text-ink-2">{d.summary}</p>
            </div>
            {next ? <button type="button" className="btn btn-primary shrink-0" onClick={() => onPick(next.slug)} data-testid="help-next">Next: {next.title.length > 34 ? `${next.title.slice(0, 32)}…` : next.title}</button> : null}
          </div>
          {d.chapters.length > 1 ? (
            <section className="mt-6" aria-labelledby="chapters">
              <h3 id="chapters" className="font-display text-lg font-bold">In this video</h3>
              <ol className="mt-2 grid gap-1 sm:grid-cols-2 xl:grid-cols-3" data-testid="help-chapters">
                {d.chapters.map((c) => {
                  const on = current === c;
                  return (
                    <li key={`${c.t}-${c.title}`}>
                      <button type="button" onClick={() => jump(c.t)} aria-current={on ? "true" : undefined}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${on ? "bg-violet-soft font-bold text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}>
                        <span className="w-11 shrink-0 font-mono text-xs tabular-nums text-muted">{clock(c.t)}</span>{c.title}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
          <p className="mt-6 text-sm text-muted">Still need help with this? <Link className="link" href={`/support/new?category=${SUPPORT_TOPIC[d.category] ?? "other"}&from=${encodeURIComponent(`/help?v=${d.slug}`)}`}>Ask support</Link>.</p>
        </>
      ) : null}
    </div>
  );
}
