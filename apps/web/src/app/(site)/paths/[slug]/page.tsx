import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight, ChevronRight, Clock, GraduationCap, Layers } from "lucide-react";
import { getPath } from "@/lib/paths-server";
import { CourseCover } from "@/components/CourseCover";
import { Price } from "@/components/CourseViews";
import { Markdown } from "@/components/Markdown";
import { FollowPath } from "@/components/paths/FollowPath";
import { hours, levelLabel, money, plural } from "@/lib/format";
import { DEL_PROGRAM, programLink } from "@/lib/del-program";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPath(slug);
  if (!p) return { title: "Career path not found" };
  const description = p.summary || `${p.courseCount} courses, ${hours(p.totalDurationSec)}, in the order to take them.`;
  return { title: `${p.title} career path`, description, alternates: { canonical: `/paths/${p.slug}` }, openGraph: { title: `${p.title} career path`, description, type: "website" } };
}

/** One career path: the courses in order, the skills each gives, and the full DEL program as the next step (rule 27). */
export default async function PathPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPath(slug);
  if (!p) notFound();
  const base = process.env.WEB_URL || "http://127.0.0.1:3000";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${p.title} career path`,
    description: p.summary,
    numberOfItems: p.steps.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: p.steps.map((s) => ({
      "@type": "ListItem",
      position: s.position,
      item: { "@type": "Course", name: s.course.title, description: s.course.subtitle || s.course.title, url: `${base}/courses/${s.course.slug}`, provider: { "@type": "Organization", name: "DevOps Easy Learning", sameAs: base } },
    })),
  };

  return (
    <div className="container-x pb-10 pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm font-bold text-ink-2">
        <Link href="/paths" className="hover:text-ink hover:underline">Career paths</Link><ChevronRight className="size-3.5 opacity-60" aria-hidden="true" />
        <span className="truncate text-muted">{p.title}</span>
      </nav>
      {/* Phones: intro, then the follow box, then the courses; desktop: the box sits beside both. */}
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="order-1 min-w-0 lg:order-none lg:col-start-1 lg:row-start-1">
          <h1 className="font-display text-[clamp(1.9rem,3.8vw,2.8rem)] font-extrabold leading-[1.08] text-ink">{p.title}</h1>
          {p.summary ? <p className="mt-3 max-w-2xl text-lg text-ink-2">{p.summary}</p> : null}
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
            <li className="inline-flex items-center gap-1.5"><Layers className="size-4 text-violet" aria-hidden="true" />{plural(p.courseCount, "course")}</li>
            <li className="inline-flex items-center gap-1.5"><Clock className="size-4 text-violet" aria-hidden="true" />{hours(p.totalDurationSec)} of video and lessons</li>
          </ul>
          {p.description ? <div className="mt-6 max-w-2xl"><Markdown source={p.description} /></div> : null}
        </div>

        <div className="order-3 min-w-0 lg:order-none lg:col-start-1 lg:row-start-2">
          <h2 className="font-display text-xl font-bold text-ink">The courses, in order</h2>
          <ol className="mt-5" data-testid="path-steps">
            {p.steps.map((s) => (
              <li key={s.course.slug} className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4 pb-8">
                <span className="absolute bottom-0 left-[1.075rem] top-10 w-0.5 bg-line" aria-hidden="true" />
                <span className="relative grid size-9 place-items-center rounded-full bg-violet font-display text-sm font-extrabold text-on-violet">{s.position}</span>
                <div className="min-w-0 rounded-panel border border-line bg-surface p-4 sm:p-5">
                  <Link href={`/courses/${s.course.slug}`} className="group grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
                    <CourseCover slug={s.course.slug} title={s.course.title} category={s.course.category?.name} thumbnailUrl={s.course.thumbnailUrl} size="sm" className="!rounded-lg" />
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-bold leading-snug sm:text-lg text-ink group-hover:text-violet">{s.course.title}</h3>
                      <p className="mt-0.5 text-sm text-ink-2">{s.course.instructor.name} · {hours(s.course.totalDurationSec)} · {levelLabel[s.course.level]}</p>
                      <p className="mt-2"><Price cents={s.course.priceCents} listCents={s.course.listPriceCents} currency={s.course.currency} /></p>
                    </div>
                  </Link>
                  {s.note ? <p className="mt-3 text-sm text-ink-2">{s.note}</p> : null}
                  {s.skills.length ? (
                    <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Skills from ${s.course.title}`}>
                      {s.skills.map((k) => <li key={k} className="rounded-full bg-violet-soft px-2.5 py-1 text-sm font-bold text-violet">{k}</li>)}
                    </ul>
                  ) : null}
                </div>
              </li>
            ))}
            <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4" data-testid="path-program-step">
              <span className="grid size-9 place-items-center rounded-full border-2 border-violet bg-surface text-violet"><GraduationCap className="size-4" aria-hidden="true" /></span>
              <div className="min-w-0 rounded-panel border border-dashed border-line-strong p-4 sm:p-5">
                <p className="text-sm font-bold text-violet">Next, if you want a guided program</p>
                <p className="mt-1 text-ink-2">DevOps Easy Learning&apos;s <b className="text-ink">{DEL_PROGRAM.name}</b> program adds live classes, mentors, projects and an internship.</p>
                <a href={programLink(DEL_PROGRAM.aboutUrl, `path-${p.slug}`)} target="_blank" rel="noopener" className="link mt-2 inline-flex items-center gap-1 text-sm">Explore the full training program<ArrowUpRight className="size-4" aria-hidden="true" /></a>
                <p className="mt-1 text-xs text-muted">Enrolment and payment for the program happen on devopseasylearning.com. Opens in a new tab.</p>
              </div>
            </li>
          </ol>
        </div>

        <aside className="order-2 lg:order-none lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start" aria-label="Follow this path">
          <div className="rounded-panel border border-line bg-surface p-5">
            <dl className="grid grid-cols-2 gap-4">
              <div><dt className="text-sm text-muted">Courses</dt><dd className="font-display text-2xl font-extrabold tabular-nums text-ink">{p.courseCount}</dd></div>
              <div><dt className="text-sm text-muted">Total time</dt><dd className="font-display text-2xl font-extrabold text-ink">{hours(p.totalDurationSec)}</dd></div>
              <div className="col-span-2"><dt className="text-sm text-muted">All courses at today&apos;s prices</dt><dd className="font-display text-2xl font-extrabold tabular-nums text-ink">{money(p.totalPriceCents, p.currency)}</dd></div>
            </dl>
            {p.skills.length ? (
              <>
                <h2 className="mt-5 text-sm font-bold text-ink">Skills you build</h2>
                <ul className="mt-2 flex flex-wrap gap-1.5">{p.skills.map((k) => <li key={k} className="rounded-full bg-surface-2 px-2.5 py-1 text-sm text-ink-2">{k}</li>)}</ul>
              </>
            ) : null}
            <div className="mt-5 border-t border-line pt-5"><FollowPath slug={p.slug} title={p.title} /></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
