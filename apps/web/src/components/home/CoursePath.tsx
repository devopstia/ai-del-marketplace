import Link from "next/link";
import { Award, BookOpenCheck, Clock, FlaskConical, ListChecks, PlayCircle, PlaySquare } from "lucide-react";
import type { CourseDetail, SectionOutline } from "@/lib/types";
import { clock, hours, plural } from "@/lib/format";
import { courseFacts, type Shot } from "@/lib/home-media";
import { CourseCover } from "../CourseCover";
import { Price } from "../CourseViews";
import { RatingInline } from "../Stars";
import { PreviewButton } from "../PreviewContext";

type Stage = { name: string; sub: string; lab: boolean; sections: { s: SectionOutline; n: number; lab: boolean }[] };

const isLab = (s: SectionOutline) => /^lab\b/i.test(s.title.trim());
const seconds = (s: SectionOutline) => s.lectures.reduce((a, l) => a + l.durationSec, 0);

/**
 * The course as a route: sections before the first lab explain the ideas, the lab sections build things, and the sections
 * after the last lab apply it to everyday tooling. Derived from the real curriculum order, so it follows the course as it grows.
 */
function stages(sections: SectionOutline[]): Stage[] {
  const numbered = sections.map((s, i) => ({ s, n: i + 1, lab: isLab(s) }));
  const first = numbered.findIndex((x) => x.lab);
  if (first < 0) return [{ name: "The course, step by step", sub: "", lab: false, sections: numbered }];
  let last = first;
  numbered.forEach((x, i) => { if (x.lab) last = i; });
  const out: Stage[] = [
    { name: "Understand", sub: "The ideas and the vocabulary, each explained with a real situation.", lab: false, sections: numbered.slice(0, first) },
    { name: "Build in labs", sub: "Hands-on labs on AWS, Azure and Docker that you run yourself.", lab: true, sections: numbered.slice(first, last + 1) },
    { name: "Automate", sub: "Put AI to work in the tools you already use.", lab: false, sections: numbered.slice(last + 1) },
  ];
  return out.filter((st) => st.sections.length);
}

function sectionTitle(s: SectionOutline, lab: boolean) {
  const t = lab ? s.title.replace(/^lab\s*:\s*/i, "") : s.title;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Featured course: a buying summary on the left, the curriculum as three stages on the right, with real lab screens. */
export function CoursePath({ c, labShots }: { c: CourseDetail; labShots: Shot[] }) {
  const f = courseFacts(c);
  const preview = f.previews[0];
  const route = stages(c.sections);
  const facts: [typeof Clock, string][] = [
    [PlaySquare, plural(f.lessons, "video lesson")],
    [Clock, `${hours(c.totalDurationSec)} of video`],
    ...(f.labs ? [[FlaskConical, plural(f.labs, "lab download")] as [typeof Clock, string]] : []),
    ...(f.quizzes ? [[ListChecks, plural(f.quizzes, "short quiz", "short quizzes")] as [typeof Clock, string]] : []),
    [Award, "Certificate when you finish"],
  ];

  return (
    <section aria-labelledby="path-title" className="container-x pt-16 md:pt-24" data-testid="course-path">
      <div className="grid gap-10 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-14 xl:grid-cols-[380px_minmax(0,1fr)] xl:gap-20">
        {/* Buying summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Course summary">
          <div className="panel overflow-hidden shadow-lift">
            <div className="relative">
              <CourseCover slug={c.slug} title={c.title} category={c.category?.name} thumbnailUrl={c.thumbnailUrl} className="!rounded-none" />
              {preview ? (
                <PreviewButton lectureId={preview.id} className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-[#141833]/90 py-1.5 pl-1.5 pr-3.5 text-sm font-bold text-white shadow-float transition-colors hover:bg-[#141833]">
                  <PlayCircle className="size-6" aria-hidden="true" />
                  <span>Free lesson<span className="sr-only">: {preview.title}</span>{preview.durationSec ? <span className="font-normal text-white/75">, {clock(preview.durationSec)}</span> : null}</span>
                </PreviewButton>
              ) : null}
            </div>
            <div className="p-5">
              <h3 className="font-display text-lg font-bold leading-snug text-ink">
                <Link href={`/courses/${c.slug}`} className="hover:text-violet">{c.title}</Link>
              </h3>
              <p className="mt-1.5 text-sm text-muted">
                By <Link href={`/instructors/${c.instructor.id}`} className="font-bold text-ink-2 hover:text-violet">{c.instructor.name}</Link>
              </p>
              {c.ratingCount ? <div className="mt-2"><RatingInline avg={c.ratingAvg} count={c.ratingCount} /></div> : null}
              <ul className="mt-4 space-y-2 border-t border-line pt-4 text-sm text-ink-2" aria-label="What the course includes">
                {facts.map(([I, t]) => <li key={t} className="flex items-center gap-2.5"><I className="size-4 shrink-0 text-muted" aria-hidden="true" />{t}</li>)}
              </ul>
              <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-line pt-4">
                <Price cents={c.priceCents} currency={c.currency} className="text-2xl" />
                <span className="text-xs text-muted">One-time price, lifetime access</span>
              </div>
              <div className="mt-4 grid gap-2">
                <Link href={`/courses/${c.slug}`} className="btn btn-primary w-full" data-testid="path-view-course">View the course</Link>
                {preview ? <PreviewButton lectureId={preview.id} className="btn btn-outline w-full"><PlayCircle className="size-4" aria-hidden="true" />Watch a free lesson</PreviewButton> : null}
              </div>
            </div>
          </div>
        </aside>

        {/* Curriculum as stages */}
        <div className="min-w-0">
          <p className="eyebrow">Featured course</p>
          <h2 id="path-title" className="h-section mt-2 max-w-2xl">One course, from the first idea to agents in production</h2>
          <p className="mt-3 max-w-2xl text-ink-2">
            {plural(c.sections.length, "section")} in the order you need them: understand the ideas, build them in labs, then automate the work you already do.
          </p>

          <ol className="mt-8 divide-y divide-line border-y border-line" aria-label="Course route">
            {route.map((st, k) => {
              const lessons = st.sections.reduce((a, x) => a + x.s.lectures.length, 0);
              const secs = st.sections.reduce((a, x) => a + seconds(x.s), 0);
              return (
                <li key={st.name} className="grid gap-x-10 gap-y-4 py-7 md:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)]">
                  <div>
                    <p className={`text-xs font-bold tabular-nums ${st.lab ? "text-cyan-ink" : "text-muted"}`}>Stage {k + 1}</p>
                    <h3 className="mt-1 flex items-center gap-2 font-display text-lg font-bold text-ink">
                      {st.name}{st.lab ? <FlaskConical className="size-4 text-cyan" aria-hidden="true" /> : null}
                    </h3>
                    <p className="mt-1 text-sm text-ink-2">{st.sub}</p>
                    <p className="mt-2 text-xs text-muted">{plural(lessons, "lesson")}, {hours(secs)}</p>
                  </div>
                  <div className="min-w-0">
                    <ol className={`grid gap-x-8 ${st.sections.length > 4 ? "sm:grid-cols-2" : ""}`}>
                      {st.sections.map((x) => (
                        <li key={x.s.id} className="flex items-baseline gap-3 border-b border-dashed border-line py-2 text-[0.95rem] last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
                          <span className={`w-5 shrink-0 text-right text-xs font-bold tabular-nums ${x.lab ? "text-cyan-ink" : "text-muted"}`}>{x.n}</span>
                          <span className="min-w-0 flex-1 text-ink">{x.lab ? <span className="sr-only">Lab: </span> : null}{sectionTitle(x.s, x.lab)}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted">{hours(seconds(x.s))}</span>
                        </li>
                      ))}
                    </ol>
                    {st.lab && labShots.length ? (
                      <ul className="mt-5 grid gap-4 sm:grid-cols-3" aria-label="Screens from the labs">
                        {labShots.map((s) => (
                          <li key={s.key}>
                            <figure>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={s.src} alt={s.alt} loading="lazy" className="aspect-video w-full rounded-lg object-cover object-left-top ring-1 ring-line" />
                              <figcaption className="mt-2 text-sm leading-snug text-ink-2">
                                {s.lesson.title.replace(/\s*\(live\)\s*$/i, "")}
                                <span className="text-muted">, {clock(s.lesson.durationSec)}</span>
                              </figcaption>
                            </figure>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="flex items-center gap-2 text-muted"><BookOpenCheck className="size-4" aria-hidden="true" />Labs run on your own computer or cloud account with the downloadable files.</p>
            <Link href={`/courses/${c.slug}#curriculum`} className="link">See every lesson</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
