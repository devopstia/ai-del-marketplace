"use client";
import Link from "next/link";
import { Pause, Play, PlayCircle } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { LOOP_FULL, LOOP_LEFT, LOOP_RIGHT } from "./Logo";
import { CourseCover } from "./CourseCover";
import { Price } from "./CourseViews";
import { RatingInline } from "./Stars";

// Stations sit on the DEL infinity loop: the left lobe is where you learn and build, the right lobe is where you ship and run.
const stations: { label: string; x: number; y: number; anchor: "start" | "end" | "middle"; dx: number; dy: number }[] = [
  { label: "Plan", x: 41, y: 13.25, anchor: "middle", dx: 0, dy: -5.5 },
  { label: "Code", x: 8.5, y: 17.75, anchor: "end", dx: -3.5, dy: -1 },
  { label: "Build", x: 8.5, y: 42.25, anchor: "end", dx: -3.5, dy: 3 },
  { label: "Test", x: 41, y: 46.75, anchor: "middle", dx: 0, dy: 8 },
  { label: "Release", x: 79, y: 46.75, anchor: "middle", dx: 0, dy: 8 },
  { label: "Deploy", x: 111.5, y: 42.25, anchor: "start", dx: 3.5, dy: 3 },
  { label: "Operate", x: 111.5, y: 17.75, anchor: "start", dx: 3.5, dy: -1 },
  { label: "Monitor", x: 79, y: 13.25, anchor: "middle", dx: 0, dy: -5.5 },
];

function subscribe(cb: () => void) {
  const m = matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
const useReducedMotion = () => useSyncExternalStore(subscribe, () => matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);

const slides = [
  { id: "loop", label: "AI + DevOps" },
  { id: "rag", label: "RAG automation" },
] as const;

function LoopSlide({ reduced }: { reduced: boolean }) {
  return (
  <svg viewBox="-16 -4 152 70" className="w-full overflow-visible" role="img" aria-label="The DevOps loop with AI at its centre: plan, code, build, test, release, deploy, operate, monitor, and back again, with AI assisting every stage.">
    <defs>
      <linearGradient id="hero-grad" x1="0" x2="120" y1="0" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="var(--violet)" />
        <stop offset="1" stopColor="var(--cyan)" />
      </linearGradient>
      <filter id="hero-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
    </defs>
    {/* AI reaches every stage */}
    <g stroke="var(--violet)" strokeWidth="0.45" strokeDasharray="0.9 1.6" opacity="0.45" fill="none">
      {stations.map((st) => <line key={st.label} x1="60" y1="30" x2={st.x} y2={st.y} />)}
    </g>
    {/* track */}
    <path d={LOOP_FULL} stroke="var(--line)" strokeWidth="7" fill="none" strokeLinecap="round" />
    <path d={LOOP_LEFT} pathLength={1} className="loop-draw" stroke="var(--violet)" strokeWidth="3.2" fill="none" strokeLinecap="round" />
    <path d={LOOP_RIGHT} pathLength={1} className="loop-draw" style={{ animationDelay: ".5s" }} stroke="var(--cyan)" strokeWidth="3.2" fill="none" strokeLinecap="round" />
    <path d={LOOP_FULL} stroke="var(--surface)" strokeWidth="0.6" strokeDasharray="0.6 2.2" fill="none" opacity="0.9" />
    {/* stations */}
    {stations.map((s, i) => (
      <g key={s.label}>
        <circle cx={s.x} cy={s.y} r="2.6" fill="var(--surface)" stroke={i < 4 ? "var(--violet)" : "var(--cyan)"} strokeWidth="1.3" />
        <text x={s.x + s.dx} y={s.y + s.dy} textAnchor={s.anchor} dominantBaseline="middle" className="fill-ink-2 font-display" style={{ fontSize: 4.1, fontWeight: 700 }}>
          {s.label}
        </text>
      </g>
    ))}
    {/* travelling learners */}
    {reduced ? null : [0, 1, 2].map((i) => (
      <g key={i}>
        <circle r="3.4" fill={i === 1 ? "var(--cyan)" : "var(--violet)"} opacity="0.45" filter="url(#hero-glow)" />
        <circle r="1.9" fill={i === 1 ? "var(--cyan)" : "var(--violet)"} stroke="var(--surface)" strokeWidth="0.8" />
        <animateMotion dur="16s" repeatCount="indefinite" begin={`${-i * 5.3}s`} path={LOOP_FULL} rotate="auto" />
      </g>
    ))}
    {reduced ? (
      <g>
        <circle cx="41" cy="13.25" r="1.9" fill="var(--violet)" />
        <circle cx="111.5" cy="42.25" r="1.9" fill="var(--cyan)" />
      </g>
    ) : null}
    {/* AI hub where the two lobes cross */}
    <g>
      {reduced ? null : (
        <circle cx="60" cy="30" r="7" fill="none" stroke="var(--violet)" strokeWidth="0.5">
          <animate attributeName="r" values="7;11;7" dur="4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0;0.6" dur="4s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx="60" cy="30" r="7" fill="url(#hero-grad)" stroke="var(--surface)" strokeWidth="1.2" />
      <text x="60" y="30.4" textAnchor="middle" dominantBaseline="middle" className="font-display" fill="#fff" style={{ fontSize: 5, fontWeight: 800, letterSpacing: "-0.02em" }}>AI</text>
    </g>
  </svg>
  );
}

// AI automation on a RAG stack: knowledge is indexed once, then an agent retrieves it to act on real incidents.
const ragEdges = ["M21 12H43", "M77 12H99", "M116 19.5V30H60V40.5", "M21 48H43", "M77 48H99"];

function RagNode({ cx, cy, title, sub, accent }: { cx: number; cy: number; title: string; sub: string; accent?: boolean }) {
  return (
    <g>
      <rect x={cx - 17} y={cy - 7.5} width="34" height="15" rx="3.2" fill={accent ? "url(#rag-grad)" : "var(--surface)"} stroke={accent ? "var(--surface)" : "var(--line-strong)"} strokeWidth={accent ? 1 : 0.5} />
      <text x={cx} y={cy - 1.6} textAnchor="middle" dominantBaseline="middle" className={accent ? "font-display" : "fill-ink font-display"} fill={accent ? "#fff" : undefined} style={{ fontSize: 3.9, fontWeight: 800 }}>{title}</text>
      <text x={cx} y={cy + 3.2} textAnchor="middle" dominantBaseline="middle" className={accent ? "" : "fill-muted"} fill={accent ? "#fff" : undefined} opacity={accent ? 0.85 : 1} style={{ fontSize: 2.5, fontWeight: 600 }}>{sub}</text>
    </g>
  );
}

function RagSlide({ reduced }: { reduced: boolean }) {
  return (
    <svg viewBox="-16 -4 152 70" className="w-full overflow-visible" role="img" aria-label="AI automation with a RAG stack: runbooks, docs and logs are embedded into a vector database; when an alert or ticket arrives, an AI agent retrieves that context and takes action with kubectl, Terraform or CI.">
      <defs>
        <linearGradient id="rag-grad" x1="43" x2="77" y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--violet)" />
          <stop offset="1" stopColor="var(--cyan)" />
        </linearGradient>
        <marker id="rag-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0 0L6 3L0 6z" fill="var(--violet)" />
        </marker>
      </defs>
      <text x="-13" y="0" className="fill-muted font-display" style={{ fontSize: 2.8, fontWeight: 800, letterSpacing: "0.12em" }}>INDEX YOUR KNOWLEDGE</text>
      <text x="-13" y="62" className="fill-muted font-display" style={{ fontSize: 2.8, fontWeight: 800, letterSpacing: "0.12em" }}>AUTOMATE WITH AN AGENT</text>
      {ragEdges.map((d, i) => (
        <path key={d} d={d} fill="none" stroke={i === 2 ? "var(--cyan)" : "var(--violet)"} strokeWidth="0.8" strokeDasharray={i === 2 ? "1.2 1.2" : undefined} markerEnd="url(#rag-arrow)" opacity="0.8" />
      ))}
      <text x="88" y="27.6" textAnchor="middle" className="fill-ink-2 font-display" style={{ fontSize: 2.9, fontWeight: 700 }}>retrieve context</text>
      <RagNode cx={4} cy={12} title="Knowledge" sub="runbooks · docs · logs" />
      <RagNode cx={60} cy={12} title="Embed" sub="chunk → vectors" />
      <RagNode cx={116} cy={12} title="Vector DB" sub="semantic search" />
      <RagNode cx={4} cy={48} title="Trigger" sub="alert or ticket" />
      <RagNode cx={60} cy={48} title="AI agent" sub="LLM + your context" accent />
      <RagNode cx={116} cy={48} title="Action" sub="kubectl · Terraform · CI" />
      {reduced ? null : ragEdges.map((d, i) => (
        <circle key={d} r="1.3" fill={i === 2 ? "var(--cyan)" : "var(--violet)"} stroke="var(--surface)" strokeWidth="0.5">
          <animateMotion dur={i === 2 ? "3s" : "2.2s"} repeatCount="indefinite" begin={`${i * 0.45}s`} path={d} />
        </circle>
      ))}
    </svg>
  );
}

export function HeroLoop({ spotlight }: { spotlight?: { slug: string; title: string; href: string; meta: string; thumbnailUrl?: string | null; ratingAvg: number; ratingCount: number; priceCents: number; currency?: string } | null }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (reduced || paused || hover) return;
    const t = setInterval(() => setActive((a) => (a + 1) % slides.length), 8000);
    return () => clearInterval(t);
  }, [reduced, paused, hover]);
  return (
    <div className="relative mx-auto flex w-full max-w-[640px] flex-col gap-3 px-5 sm:px-0 lg:h-full lg:justify-center">
      <div
        className="grid"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocusCapture={() => setHover(true)}
        onBlurCapture={() => setHover(false)}
      >
        {slides.map((sl, i) => (
          <div
            key={sl.id}
            id={`hero-slide-${sl.id}`}
            role="tabpanel"
            aria-labelledby={`hero-tab-${sl.id}`}
            aria-hidden={i !== active}
            inert={i !== active}
            className={`[grid-area:1/1] ${reduced ? "" : "transition-opacity duration-700"} ${i === active ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            {sl.id === "loop" ? <LoopSlide reduced={reduced} /> : <RagSlide reduced={reduced} />}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2">
        <div role="tablist" aria-label="Hero illustrations" className="flex gap-1 rounded-full border border-line bg-surface p-1">
          {slides.map((sl, i) => (
            <button
              key={sl.id}
              id={`hero-tab-${sl.id}`}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-controls={`hero-slide-${sl.id}`}
              onClick={() => { setActive(i); setPaused(true); }}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${i === active ? "bg-violet text-white" : "text-ink-2 hover:text-violet"}`}
            >
              {sl.label}
            </button>
          ))}
        </div>
        {reduced ? null : (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Play slideshow" : "Pause slideshow"}
            className="grid size-8 place-items-center rounded-full border border-line bg-surface text-ink-2 hover:border-violet hover:text-violet"
          >
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          </button>
        )}
      </div>
      {spotlight ? (
        <Link href={spotlight.href} className="ml-auto hidden w-full max-w-md items-center gap-4 self-end rounded-tile border border-line bg-surface p-3 shadow-float transition-colors hover:border-violet sm:flex">
          <CourseCover slug={spotlight.slug} title={spotlight.title} thumbnailUrl={spotlight.thumbnailUrl} size="sm" className="!w-32 shrink-0 !rounded-lg" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-bold text-mint"><PlayCircle className="size-3.5" />Free preview available</p>
            <p className="mt-1 line-clamp-2 font-display text-sm font-bold leading-snug text-ink">{spotlight.title}</p>
            <p className="mt-1 line-clamp-1 text-xs text-muted">{spotlight.meta}</p>
            <p className="mt-1.5 flex items-center gap-3"><RatingInline avg={spotlight.ratingAvg} count={spotlight.ratingCount} /><Price cents={spotlight.priceCents} currency={spotlight.currency} className="text-sm" /></p>
          </div>
        </Link>
      ) : null}
    </div>
  );
}
