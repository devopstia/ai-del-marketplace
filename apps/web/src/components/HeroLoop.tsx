"use client";
import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { useSyncExternalStore } from "react";
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

export function HeroLoop({ spotlight }: { spotlight?: { slug: string; title: string; href: string; meta: string; thumbnailUrl?: string | null; ratingAvg: number; ratingCount: number; priceCents: number; currency?: string } | null }) {
  const reduced = useReducedMotion();
  return (
    <div className="relative mx-auto flex w-full max-w-[640px] flex-col gap-3 px-5 sm:px-0 lg:h-full lg:justify-center">
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
