"use client";
import Link from "next/link";
import { use, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { clock } from "@/lib/format";
import { SUPPORT_TOPIC, toDetail } from "@/lib/help";
import { Skeleton } from "@/components/Empty";
import { VideoPlayer, type PlayerHandle } from "@/components/VideoPlayer";
import { HelpRow } from "@/components/help/HelpRow";

export default function HelpVideo({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data, error } = useApi(`/help/videos/${encodeURIComponent(slug)}`, toDetail);
  const player = useRef<PlayerHandle>(null);
  const router = useRouter();
  const [now, setNow] = useState(0);
  const jump = (t: number) => {
    const v = player.current?.video;
    if (!v) return;
    v.currentTime = t;
    void v.play().catch(() => {});
  };
  const current = data ? [...data.chapters].reverse().find((c) => now >= c.t - 0.25) : undefined;

  return (
    <div className="container-x max-w-6xl pb-14 pt-6">
      <Link href="/help" className="inline-flex items-center gap-1.5 text-sm font-bold text-violet hover:underline"><ArrowLeft className="size-4" />Platform videos</Link>
      {error ? <p className="mt-6 text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="mt-4 aspect-video w-full max-w-4xl" /> : null}
      {data ? (
        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <VideoPlayer ref={player} key={data.playback.url} src={data.playback.url} format={data.playback.format} captionsUrl={data.playback.captionsUrl} title={data.title} onTime={(t) => setNow(t)}
              onNext={data.next[0] ? () => router.push(`/help/${data.next[0].slug}`) : undefined} nextTitle={data.next[0]?.title} />
            <p className="mt-5 text-sm font-bold text-violet">{data.categoryName}</p>
            <h1 className="mt-1 font-display text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold leading-tight">{data.title}</h1>
            <p className="mt-2 max-w-3xl text-ink-2">{data.summary}</p>
            {data.chapters.length > 1 ? (
              <section className="mt-6" aria-labelledby="chapters">
                <h2 id="chapters" className="font-display text-lg font-bold">In this video</h2>
                <ol className="mt-2 grid gap-1 sm:grid-cols-2" data-testid="help-chapters">
                  {data.chapters.map((c) => {
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
          </div>
          <aside className="grid content-start gap-6">
            {data.next.length ? (
              <section aria-labelledby="next">
                <h2 id="next" className="font-display text-lg font-bold">Up next</h2>
                <ul className="mt-2 grid gap-1">{data.next.map((v) => <li key={v.slug}><HelpRow v={v} compact /></li>)}</ul>
              </section>
            ) : null}
            <div className="rounded-panel border border-line bg-surface p-4">
              <p className="font-bold">Still need help?</p>
              <p className="mt-1 text-sm text-ink-2">Tell us what you’re trying to do and we’ll reply here and by email.</p>
              <Link href={`/support/new?category=${SUPPORT_TOPIC[data.category] ?? "other"}&from=${encodeURIComponent(`/help/${data.slug}`)}`} className="btn btn-ghost btn-sm mt-3"><LifeBuoy className="size-4" />Contact support</Link>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
