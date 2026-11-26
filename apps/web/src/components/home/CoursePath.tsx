import Link from "next/link";
import { FlaskConical, PlayCircle } from "lucide-react";
import type { CourseDetail, SectionOutline } from "@/lib/types";
import { clock, date, hours, plural } from "@/lib/format";
import { CourseCover } from "../CourseCover";
import { Price } from "../CourseViews";
import { PreviewButton, PreviewProvider } from "../PreviewContext";

type Stage = { name: string; sub: string; sections: { s: SectionOutline; n: number; lab: boolean }[] };

const isLab = (s: SectionOutline) => /^lab\b/i.test(s.title.trim());
const minutes = (s: SectionOutline) => s.lectures.reduce((a, l) => a + l.durationSec, 0);

/**
 * The course as a route: sections before the first lab explain the ideas, the lab sections build things, and the sections
 * after the last lab apply it to everyday tooling. Derived from the real curriculum order, so it follows the course as it grows.
 */
function stages(sections: SectionOutline[]): Stage[] {
  const numbered = sections.map((s, i) => ({ s, n: i + 1, lab: isLab(s) }));
  const first = numbered.findIndex((x) => x.lab);
  if (first < 0) return [{ name: "The course, step by step", sub: "", sections: numbered }];
  let last = first;
  numbered.forEach((x, i) => { if (x.lab) last = i; });
  const out: Stage[] = [
    { name: "Understand", sub: "The ideas and the vocabulary, each explained with a real situation", sections: numbered.slice(0, first) },
    { name: "Build in labs", sub: "Hands-on labs on AWS, Azure and Docker that you run yourself", sections: numbered.slice(first, last + 1) },
    { name: "Automate", sub: "Put AI to work in the tools you already use", sections: numbered.slice(last + 1) },
  ];
  return out.filter((st) => st.sections.length);
}

function Stop({ s, n, lab }: { s: SectionOutline; n: number; lab: boolean }) {
  const stripped = lab ? s.title.replace(/^lab\s*:\s*/i, "") : s.title;
  const title = stripped.charAt(0).toUpperCase() + stripped.slice(1);
  return (
    <li className="relative grid grid-cols-[2rem_1fr] gap-x-3 py-2.5">
      <span className={`relative z-10 grid size-8 place-items-center rounded-full text-sm font-bold tabular-nums ${lab ? "bg-cyan text-[#04253a]" : "border-[1.5px] border-line-strong bg-paper text-ink-2"}`}>{n}</span>
      <span className="min-w-0 pt-1">
        <span className="block font-bold leading-snug text-ink">
          {lab ? <span className="sr-only">Lab: </span> : null}{title}
          {lab ? <FlaskConical className="ml-1.5 inline size-4 align-[-2px] text-cyan" aria-hidden="true" /> : null}
        </span>
        <span className="mt-0.5 block text-sm text-muted">{plural(s.lectures.length, "lesson")}, {hours(minutes(s))}</span>
      </span>
    </li>
  );
}

export function CoursePath({ c }: { c: CourseDetail }) {
  const previews = c.sections.flatMap((s) => s.lectures).filter((l) => l.isPreview);
  const lessons = c.sections.reduce((a, s) => a + s.lectures.length, 0);
  const quizzes = c.sections.reduce((a, s) => a + s.lectures.filter((l) => l.hasQuiz).length, 0);
  const route = stages(c.sections);
  const facts = [
    plural(lessons, "video lesson"),
    `${hours(c.totalDurationSec)} in total`,
    c.resourceCount ? plural(c.resourceCount, "lab download") : null,
    quizzes ? plural(quizzes, "quiz", "quizzes") : null,
    "Certificate when you finish",
  ].filter(Boolean) as string[];

  return (
    <PreviewProvider courseTitle={c.title} slug={c.slug} previews={previews}>
      <section aria-labelledby="path-title" className="container-x pt-16 md:pt-20" data-testid="course-path">
        <h2 id="path-title" className="max-w-3xl font-display text-[clamp(1.5rem,2.6vw,2.1rem)] font-extrabold text-ink">
          One course, from the first idea to agents in production
        </h2>
        <p className="mt-2 max-w-2xl text-ink-2">
          {route.length > 1 ? `${plural(c.sections.length, "section")} in the order you need them. Watch a free lesson before you decide.` : "Watch a free lesson before you decide."}
        </p>

        <div className="mt-9 grid items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
          <div className="relative overflow-hidden rounded-panel ring-1 ring-line">
            <CourseCover slug={c.slug} title={c.title} category={c.category?.name} thumbnailUrl={c.thumbnailUrl} size="lg" className="!rounded-none" />
            {previews[0] ? (
              <PreviewButton lectureId={previews[0].id} className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-[#141833]/90 py-1.5 pl-1.5 pr-3.5 text-sm font-bold text-white shadow-float transition-colors hover:bg-[#141833]">
                <PlayCircle className="size-6" aria-hidden="true" />
                <span data-qa-on-media>Free lesson<span className="sr-only">: {previews[0].title}</span>{previews[0].durationSec ? <span className="font-normal text-white/75">, {clock(previews[0].durationSec)}</span> : null}</span>
              </PreviewButton>
            ) : null}
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-[clamp(1.4rem,2.4vw,1.9rem)] font-extrabold leading-tight text-ink">
              <Link href={`/courses/${c.slug}`} className="hover:text-violet">{c.title}</Link>
            </h3>
            {c.subtitle ? <p className="mt-3 text-lg text-ink-2">{c.subtitle}</p> : null}
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-2" aria-label="What the course includes">
              {facts.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Price cents={c.priceCents} listCents={c.listPriceCents} currency={c.currency} className="text-3xl" />
              <div className="flex flex-wrap gap-2">
                <Link href={`/courses/${c.slug}`} className="btn btn-primary" data-testid="path-view-course">View the course</Link>
                {previews[0] ? <PreviewButton lectureId={previews[0].id} className="btn btn-outline"><PlayCircle className="size-4" aria-hidden="true" />Watch a free lesson</PreviewButton> : null}
              </div>
            </div>
            <p className="mt-5 text-sm text-muted">
              Taught by <Link href={`/instructors/${c.instructor.id}`} className="font-bold text-ink-2 hover:text-violet">{c.instructor.name}</Link>
              {c.updatedAt ? <>, updated {date(c.updatedAt)}</> : null}
            </p>
          </div>
        </div>

        {/* A stage with many sections takes two columns, so the columns end at about the same height. */}
        <ol className="mt-12 grid gap-x-10 gap-y-10 border-t border-line pt-10 md:grid-cols-2 lg:grid-cols-4" aria-label="Course route">
          {route.map((st) => {
            const wide = st.sections.length > 6;
            const half = Math.ceil(st.sections.length / 2);
            const parts = wide ? [st.sections.slice(0, half), st.sections.slice(half)] : [st.sections];
            return (
              <li key={st.name} className={`min-w-0 ${wide || route.length === 1 ? "md:col-span-2" : ""}`}>
                <h3 className="font-display text-xl font-extrabold text-ink">{st.name}</h3>
                {st.sub ? <p className="mt-1 max-w-md text-sm text-ink-2">{st.sub}</p> : null}
                <div className={`mt-4 grid gap-x-10 ${parts.length > 1 ? "sm:grid-cols-2" : ""}`}>
                  {parts.map((part, i) => (
                    <ol key={i} start={part[0]?.n} className="relative before:absolute before:bottom-6 before:left-4 before:top-6 before:w-px before:bg-line-strong">
                      {part.map((x) => <Stop key={x.s.id} {...x} />)}
                    </ol>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-6 text-sm text-muted">
          Sections in <span className="font-bold text-cyan-ink">cyan</span> with <FlaskConical className="inline size-4 align-[-2px] text-cyan" aria-label="the flask" /> are labs: you run them on your own computer or cloud account with the downloadable files.
        </p>
      </section>
    </PreviewProvider>
  );
}
