"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, FlaskConical, Pause, Play, PlayCircle, Search } from "lucide-react";
import { PreviewButton } from "../PreviewContext";
import { clock } from "@/lib/format";
import type { Shot } from "@/lib/home-media";

export type HeroCourse = {
  slug: string;
  title: string;
  subtitle?: string | null;
  price: string;
  instructor: string;
  thumbnailUrl?: string | null;
  facts: string[];
  previewId?: string | null;
  previewLength?: number;
};

const INTERVAL = 8000;

function subscribe(cb: () => void) {
  const m = matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
const useReducedMotion = () => useSyncExternalStore(subscribe, () => matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);

/** A real frame from a lesson, captioned with that lesson's own title and length. */
function Frame({ shot, className = "", top = false }: { shot: Shot; className?: string; top?: boolean }) {
  return (
    <figure className={`flex overflow-hidden rounded-tile bg-[#0b0e22] ring-1 ring-white/12 shadow-[0_24px_60px_-24px_rgba(0,0,0,.7)] ${top ? "flex-col-reverse" : "flex-col"} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shot.src} alt={shot.alt} className="block aspect-video w-full object-cover object-left-top" />
      <figcaption className={`flex min-w-0 items-center gap-2 border-white/10 bg-[#0b0e22] px-3 py-2 text-[0.8rem] text-white/80 ${top ? "border-b" : "border-t"}`}>
        <FlaskConical className="size-3.5 shrink-0 text-cyan" aria-hidden="true" />
        <span className="truncate">{shot.lesson.title.replace(/\s*\(live\)\s*$/i, "")}</span>
        {shot.lesson.durationSec ? <span className="ml-auto shrink-0 tabular-nums text-white/55">{clock(shot.lesson.durationSec)}</span> : null}
      </figcaption>
    </figure>
  );
}

export function HomeHero({ course, searches, labShots, quizShot }: { course: HeroCourse | null; searches: string[]; labShots: Shot[]; quizShot: Shot | null }) {
  const reduced = useReducedMotion();
  const slides = course ? 2 : 1;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false); // the visitor pressed pause
  const [held, setHeld] = useState(false); // pointer or keyboard focus is inside the hero
  const root = useRef<HTMLElement>(null);
  const go = useCallback((n: number) => setI(((n % slides) + slides) % slides), [slides]);

  useEffect(() => {
    if (slides < 2 || reduced || paused || held) return;
    const t = setTimeout(() => go(i + 1), INTERVAL);
    return () => clearTimeout(t);
  }, [i, slides, reduced, paused, held, go]);

  const auto = slides > 1 && !reduced;
  const names = ["Courses", "Featured course"];
  const [mainShot, sideShot] = labShots;

  return (
    <section
      ref={root}
      aria-roledescription="carousel"
      aria-label="Introduction"
      className="relative overflow-hidden bg-stage text-white"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => { if (!root.current?.contains(e.relatedTarget as Node)) setHeld(false); }}
    >
      {/* One faint light source, top right; no glow effects. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_85%_0%,rgba(122,108,240,.22),transparent_70%)]" />
      <div className="container-x relative">
        {/* Both slides share one grid cell, so the band keeps the height of the taller slide (no jump between slides). */}
        <div className="grid grid-cols-[minmax(0,1fr)]">
          {/* Slide 1: the marketplace */}
          <div
            role="group"
            aria-roledescription="slide"
            aria-label={`1 of ${slides}: ${names[0]}`}
            aria-hidden={i !== 0}
            inert={i !== 0}
            className={`col-start-1 row-start-1 grid grid-cols-[minmax(0,1fr)] items-center gap-10 pb-14 pt-12 transition-opacity duration-500 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-14 lg:pb-20 lg:pt-16 ${i === 0 ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            <div className={`max-w-xl ${i === 0 ? "slide-in" : ""}`}>
              <p className="text-sm font-bold text-cyan">AI and DevOps courses</p>
              <h1 className="mt-3 font-display text-[clamp(2.1rem,4.2vw,3.35rem)] font-bold leading-[1.06] tracking-[-0.03em]">
                Learn AI and DevOps the way production works.
              </h1>
              <p className="mt-5 max-w-lg text-[1.075rem] leading-relaxed text-white/75">
                Courses from engineers who build and run these systems. Every lesson ends with a lab you can run on your laptop or your own cloud account.
              </p>
              <form action="/courses" role="search" className="mt-8 flex max-w-lg items-center gap-2 rounded-control bg-white p-1.5 pl-4 shadow-lift">
                <Search className="size-5 shrink-0 text-[#5a6079]" aria-hidden="true" />
                <input name="q" type="search" aria-label="Search courses" placeholder="What do you want to build?" className="h-11 min-w-0 flex-1 bg-transparent text-base text-[#141833] placeholder:text-[#5a6079] focus:outline-none" />
                <button className="btn btn-primary">Search</button>
              </form>
              <div className="mt-5 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm">
                <span className="mr-1 text-white/60">Popular:</span>
                {searches.map((s) => (
                  <Link key={s} href={`/courses?q=${encodeURIComponent(s)}`} className="rounded-md bg-white/8 px-2.5 py-1 font-bold text-white/85 ring-1 ring-white/12 hover:bg-white/15 hover:text-white">{s}</Link>
                ))}
              </div>
            </div>
            {mainShot && course ? (
              <Link href={`/courses/${course.slug}#curriculum`} className="group relative block sm:pb-16 lg:pb-12" aria-label={`See the labs in ${course.title}`}>
                <Frame shot={mainShot} top className="transition-transform duration-300 group-hover:-translate-y-0.5 lg:ml-6" />
                {sideShot ? (
                  <Frame shot={sideShot} className="absolute -left-2 bottom-0 hidden w-[46%] sm:flex lg:-left-6" />
                ) : null}
              </Link>
            ) : null}
          </div>

          {/* Slide 2: the featured course */}
          {course ? (
            <div
              role="group"
              aria-roledescription="slide"
              aria-label={`2 of ${slides}: ${names[1]}`}
              aria-hidden={i !== 1}
              inert={i !== 1}
              className={`col-start-1 row-start-1 grid grid-cols-[minmax(0,1fr)] items-center gap-10 pb-14 pt-12 transition-opacity duration-500 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-14 lg:pb-20 lg:pt-16 ${i === 1 ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
              <div className={`max-w-xl ${i === 1 ? "slide-in" : ""}`}>
                <p className="text-sm font-bold text-cyan">Featured course</p>
                <h2 className="mt-3 font-display text-[clamp(1.85rem,3.4vw,2.7rem)] font-bold leading-[1.08] tracking-[-0.025em]">
                  <Link href={`/courses/${course.slug}`} className="hover:underline hover:decoration-white/40 hover:underline-offset-4">{course.title}</Link>
                </h2>
                {course.subtitle ? <p className="mt-4 text-[1.05rem] leading-relaxed text-white/75">{course.subtitle}</p> : null}
                <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-white/70" aria-label="What the course includes">
                  {course.facts.map((f) => <li key={f} className="flex items-center gap-4 [&:not(:first-child)]:before:size-1 [&:not(:first-child)]:before:rounded-full [&:not(:first-child)]:before:bg-white/30">{f}</li>)}
                </ul>
                <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
                  <span className="font-display text-3xl font-bold">{course.price}</span>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/courses/${course.slug}`} className="btn btn-cyan">View the course<ArrowRight className="size-4" aria-hidden="true" /></Link>
                    {course.previewId ? (
                      <PreviewButton lectureId={course.previewId} className="btn border border-white/25 text-white hover:bg-white/10">
                        <PlayCircle className="size-4" aria-hidden="true" />Watch a free lesson
                      </PreviewButton>
                    ) : null}
                  </div>
                </div>
                <p className="mt-5 text-sm text-white/60">Taught by {course.instructor}</p>
              </div>
              <div className="relative sm:pb-16 lg:pb-12">
                <div className="relative overflow-hidden rounded-tile ring-1 ring-white/12 shadow-[0_24px_60px_-24px_rgba(0,0,0,.7)] lg:ml-6">
                  {course.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={course.thumbnailUrl} alt="" className="block aspect-video w-full object-cover" />
                  ) : <div className="aspect-video w-full bg-[#1b2042]" />}
                  {course.previewId ? (
                    <PreviewButton lectureId={course.previewId} className="absolute inset-0 flex items-end p-3 transition-colors hover:bg-black/10">
                      <span className="flex items-center gap-2.5 rounded-full bg-[#141833]/90 py-2 pl-2 pr-4 text-sm font-bold text-white shadow-float">
                        <PlayCircle className="size-7" aria-hidden="true" />
                        Free lesson{course.previewLength ? <span className="font-normal text-white/70">{clock(course.previewLength)}</span> : null}
                      </span>
                    </PreviewButton>
                  ) : null}
                </div>
                {quizShot ? (
                  <figure className="absolute -right-2 bottom-0 hidden w-[42%] overflow-hidden rounded-tile bg-white ring-1 ring-white/12 shadow-[0_24px_60px_-24px_rgba(0,0,0,.7)] sm:block lg:-right-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={quizShot.src} alt={quizShot.alt} className="block aspect-video w-full object-cover" />
                    <figcaption className="border-t border-black/5 bg-[#0b0e22] px-3 py-2 text-[0.8rem] text-white/80">A short quiz after each lesson</figcaption>
                  </figure>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {slides > 1 ? (
          <div className="relative -mt-4 flex items-center gap-3 pb-8 lg:-mt-8 lg:pb-10">
            <div className="flex items-center gap-1" role="group" aria-label="Choose a slide">
              {names.slice(0, slides).map((n, k) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => go(k)}
                  aria-current={i === k ? "true" : undefined}
                  className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-bold transition-colors ${i === k ? "text-white" : "text-white/55 hover:text-white/85"}`}
                >
                  <span className="relative h-1 w-8 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
                    {i === k ? (
                      <span
                        key={`${i}-${paused || held}`}
                        className="absolute inset-y-0 left-0 rounded-full bg-cyan"
                        style={auto && !paused && !held ? { animation: `hero-progress ${INTERVAL}ms linear forwards` } : { width: "100%" }}
                      />
                    ) : null}
                  </span>
                  <span className="hidden sm:inline">{n}</span>
                  <span className="sr-only sm:hidden">{n}</span>
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1">
              {auto ? (
                <button type="button" onClick={() => setPaused((p) => !p)} className="grid size-9 place-items-center rounded-full text-white/75 ring-1 ring-white/15 hover:bg-white/10 hover:text-white" aria-label={paused ? "Play slides" : "Pause slides"}>
                  {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                </button>
              ) : null}
              <button type="button" onClick={() => go(i - 1)} className="grid size-9 place-items-center rounded-full text-white/75 ring-1 ring-white/15 hover:bg-white/10 hover:text-white" aria-label="Previous slide"><ChevronLeft className="size-4" /></button>
              <button type="button" onClick={() => go(i + 1)} className="grid size-9 place-items-center rounded-full text-white/75 ring-1 ring-white/15 hover:bg-white/10 hover:text-white" aria-label="Next slide"><ChevronRight className="size-4" /></button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
