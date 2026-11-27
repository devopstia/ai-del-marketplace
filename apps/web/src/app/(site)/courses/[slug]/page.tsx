import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Check, ChevronRight, Clock, Globe, BarChart3, RefreshCw, Users, MessageSquareReply } from "lucide-react";
import { getCourse, getReviews } from "@/lib/catalog";
import { date, hours, languageLabel, levelLabel, plural } from "@/lib/format";
import { Stars } from "@/components/Stars";
import { Avatar } from "@/components/Avatar";
import { Markdown } from "@/components/Markdown";
import { Curriculum } from "@/components/Curriculum";
import { PreviewProvider } from "@/components/PreviewContext";
import { CourseFaq, courseFaqItems } from "@/components/CourseFaq";
import { getRefundPolicy } from "@/lib/refund-policy-server";
import { JsonLd } from "@/components/JsonLd";
import { abs, breadcrumbLd, courseLd, faqLd, pageMeta, plainText, topicPath } from "@/lib/seo";
import { ShareButtons } from "@/components/ShareButtons";
import { ProgramNote } from "@/components/promo/FullProgram";
import { PurchaseCard } from "@/components/PurchaseCard";
import { ReviewForm } from "@/components/ReviewForm";
import { WatchedBadge } from "@/components/WatchedBadge";
import { courseBy, taughtBy } from "@/lib/brand";
import { OfficialBadge } from "@/components/OfficialBadge";
import { RelatedCourses } from "@/components/RelatedCourses";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCourse(slug);
  if (!c) return { title: "Course not found", robots: { index: false } };
  const description = plainText(c.subtitle || c.description) || `${c.title}: an online course by ${courseBy(c.instructor)}${c.instructor.taughtBy ? `, designed by ${c.instructor.taughtBy},` : taughtBy(c.instructor) ? `, taught by ${c.instructor.name},` : ""} on DevOps Easy Learning.`;
  // Only a published course shares its own banner; a draft seen by its instructor or an admin is never indexed and
  // gets the site banner, so nothing about it reaches a link preview (docs/SOCIAL_SHARING.md).
  const published = c.status === "published";
  return pageMeta({ title: c.title, description, path: `/courses/${c.slug}`, image: published ? c.share : null, type: "article", noindex: !published });
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getCourse(slug);
  if (!c) notFound();
  const policy = await getRefundPolicy();
  const reviews = await getReviews(slug, { ratingAvg: c.ratingAvg, ratingCount: c.ratingCount });
  const lecturePreviews = c.sections.flatMap((s) => s.lectures).filter((l) => l.isPreview && l.type === "video");
  const previews = c.hasPromo ? [{ id: "promo", title: "Course trailer", type: "video" as const, durationSec: 0, isPreview: true }, ...lecturePreviews] : lecturePreviews;
  const maxBar = Math.max(1, ...Object.values(reviews.breakdown));
  const totalB = Object.values(reviews.breakdown).reduce((a, b) => a + b, 0) || 1;
  const crumbs: [string, string][] = [["Courses", "/courses"], ...(c.category ? [[c.category.name, topicPath(c.category.slug)] as [string, string]] : []), [c.title, `/courses/${c.slug}`]];

  return (
    <PreviewProvider courseTitle={c.title} slug={c.slug} previews={previews}>
      <JsonLd data={courseLd(c)} />
      <JsonLd data={breadcrumbLd(crumbs)} />
      <JsonLd data={faqLd(courseFaqItems(c, policy))} />
      <section className="bg-stage text-white">
        <div className="container-x py-10 md:py-14">
          <div className="lg:max-w-[calc(100%-420px)]">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm font-bold text-[#9fd9f5]">
              <Link href="/courses" className="hover:underline">Courses</Link>
              {c.category ? <><ChevronRight className="size-3.5 opacity-60" /><Link href={topicPath(c.category.slug)} className="hover:underline">{c.category.name}</Link></> : null}
            </nav>
            <h1 className="mt-4 font-display text-[clamp(1.9rem,4vw,2.9rem)] font-extrabold leading-[1.06] tracking-[-0.03em]">{c.title}</h1>
            <p className="mt-4 max-w-2xl text-lg text-white/80">{c.subtitle}</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {c.ratingCount ? (
                <a href="#reviews" className="inline-flex items-center gap-1.5 hover:underline">
                  <span className="font-bold text-[#f2b53c]">{c.ratingAvg.toFixed(1)}</span><Stars value={c.ratingAvg} size={14} />
                  <span className="text-white/70">({c.ratingCount.toLocaleString("en-US")} ratings)</span>
                </a>
              ) : <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-bold text-[#9fd9f5]">New course</span>}
              {c.studentCount ? <span className="inline-flex items-center gap-1.5 text-white/80"><Users className="size-4" />{plural(c.studentCount, "learner")}</span> : null}
            </div>
            {taughtBy(c.instructor) ? (
              <p className="mt-4 text-sm text-white/80" data-testid="course-brand">Created by <b className="text-white">{courseBy(c.instructor)}</b> · {c.instructor.taughtBy ? <>Designed by <b className="text-[#9fd9f5]">{c.instructor.taughtBy}</b></> : <>Taught by <Link href={`/instructors/${c.instructor.id}`} className="font-bold text-[#9fd9f5] underline-offset-2 hover:underline">{c.instructor.name}</Link></>}</p>
            ) : (
              <p className="mt-4 text-sm text-white/80">Created by <Link href={`/instructors/${c.instructor.id}`} className="font-bold text-[#9fd9f5] underline-offset-2 hover:underline">{c.instructor.name}</Link></p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/70">
              {c.updatedAt ? <span className="inline-flex items-center gap-1.5"><RefreshCw className="size-4" />Updated {date(c.updatedAt)}</span> : null}
              <span className="inline-flex items-center gap-1.5"><Globe className="size-4" />{languageLabel(c.language)}</span>
              <span className="inline-flex items-center gap-1.5"><BarChart3 className="size-4" />{levelLabel[c.level]}</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="size-4" />{hours(c.totalDurationSec)}</span>
            </div>
            {c.status === "published" ? <div className="mt-5"><ShareButtons title={c.title} url={abs(`/courses/${c.slug}`)} tone="stage" /></div> : null}
          </div>
        </div>
      </section>

      <div className="container-x lg:grid lg:grid-cols-[1fr_380px] lg:gap-12">
        <div className="min-w-0 pt-8 lg:pt-10">
          <div className="mb-10 lg:hidden"><PurchaseCard course={c} firstPreviewId={previews[0]?.id} /></div>

          {c.objectives.length ? (
            <section className="rounded-panel border border-line bg-surface p-6 md:p-7">
              <h2 className="font-display text-2xl font-extrabold">What you’ll learn</h2>
              <ul className="mt-5 grid gap-x-8 gap-y-3 md:grid-cols-2">
                {c.objectives.map((o) => (
                  <li key={o} className="flex gap-3 text-[0.95rem] text-ink-2"><Check className="mt-0.5 size-5 shrink-0 text-mint" aria-hidden="true" />{o}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-12">
            <h2 className="mb-4 font-display text-2xl font-extrabold">Course content</h2>
            <Curriculum sections={c.sections} />
          </section>

          {c.requirements.length ? (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-extrabold">Requirements</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-ink-2 marker:text-violet">{c.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
            </section>
          ) : null}

          {c.description ? (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-extrabold">About this course</h2>
              <Markdown source={c.description} className="prose-del mt-3" />
            </section>
          ) : null}

          <section className="mt-12" aria-labelledby="instructor-h">
            <h2 id="instructor-h" className="font-display text-2xl font-extrabold">{c.instructor.taughtBy ? "Course designer" : "Your instructor"}</h2>
            {c.instructor.taughtBy ? (
              // A DEL course designed by a named member of the DEL team (owner 2026-11-26; "Designed by", owner 2026-11-27).
              <div className="mt-5 flex flex-col gap-5 sm:flex-row" data-testid="taught-by">
                <Avatar name={c.instructor.taughtBy} size={88} />
                <div className="min-w-0">
                  <p className="font-display text-xl font-bold text-ink">{c.instructor.taughtBy}</p>
                  <p className="text-ink-2">Course designer at <Link href={`/instructors/${c.instructor.id}`} className="link">{courseBy(c.instructor)}</Link></p>
                </div>
              </div>
            ) : (
            <div className="mt-5 flex flex-col gap-5 sm:flex-row">
              <Avatar name={c.instructor.name} src={c.instructor.avatarUrl} size={88} />
              <div className="min-w-0">
                <Link href={`/instructors/${c.instructor.id}`} className="font-display text-xl font-bold text-violet hover:underline">{c.instructor.name}</Link>
                {c.instructor.official ? <OfficialBadge className="mt-1.5" /> : null}
                {c.instructor.headline ? <p className="text-ink-2">{c.instructor.headline}</p> : null}
                <p className="mt-2 flex flex-wrap gap-x-5 text-sm text-muted">
                  {c.instructor.ratingAvg ? <span>{c.instructor.ratingAvg.toFixed(1)} instructor rating</span> : null}
                  {c.instructor.studentCount ? <span>{plural(c.instructor.studentCount, "learner")}</span> : null}
                  {c.instructor.courseCount ? <span>{c.instructor.courseCount} courses</span> : null}
                </p>
                {c.instructor.bio ? <Markdown source={c.instructor.bio} className="prose-del mt-3 text-[0.95rem]" /> : null}
              </div>
            </div>
            )}
          </section>

          <CourseFaq c={c} policy={policy} />

          <div className="mt-10 max-w-2xl"><ProgramNote placement="course-page" /></div>

          <section id="reviews" className="mt-14 scroll-mt-24">
            <h2 className="font-display text-2xl font-extrabold">Learner reviews</h2>
            <p className="mt-1 text-sm text-muted">Only learners who enrolled can leave a review.</p>
            {reviews.ratingCount || reviews.items.length ? (
              <div className="mt-6 grid gap-8 md:grid-cols-[220px_1fr]">
                <div>
                  <p className="font-display text-6xl font-extrabold leading-none text-amber">{reviews.ratingAvg.toFixed(1)}</p>
                  <Stars value={reviews.ratingAvg} size={18} className="mt-2" />
                  <p className="mt-1 text-sm text-muted">Course rating, {reviews.ratingCount.toLocaleString("en-US")} ratings</p>
                  <p className="mt-3 text-sm text-ink-2">Only enrolled students can review, and each review shows how much of the course its author really watched.</p>
                </div>
                <ul className="space-y-2" aria-label="Rating breakdown">
                  {([5, 4, 3, 2, 1] as const).map((s) => (
                    <li key={s} className="grid grid-cols-[1fr_auto_3rem] items-center gap-3 text-sm">
                      <span className="h-2.5 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-amber" style={{ width: `${(reviews.breakdown[s] / maxBar) * 100}%` }} /></span>
                      <Stars value={s} size={12} />
                      <span className="text-right tabular-nums text-muted">{Math.round((reviews.breakdown[s] / totalB) * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-8"><ReviewForm slug={c.slug} enrolled={c.enrolled} /></div>
            {reviews.items.length ? (
              <ul className="grid gap-x-10 divide-y divide-line md:grid-cols-2 md:divide-y-0">
                {reviews.items.slice(0, 8).map((r) => (
                  <li key={r.id} className="py-6 md:border-t md:border-line">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.user.name} src={r.user.avatarUrl} size={40} />
                      <div>
                        <p className="font-bold text-ink">{r.user.name}</p>
                        <p className="flex items-center gap-2 text-xs text-muted"><Stars value={r.rating} size={12} />{date(r.createdAt)}</p>
                      </div>
                    </div>
                    <WatchedBadge watchedPercent={r.watchedPercent} completed={r.completed} className="mt-2" />
                    {r.body ? <p className="mt-3 text-[0.95rem] text-ink-2">{r.body}</p> : null}
                    {r.instructorReply ? (
                      <div className="mt-3 border-l-2 border-violet pl-3 text-sm">
                        <p className="flex items-center gap-1.5 font-bold text-ink"><MessageSquareReply className="size-4 text-violet" />Reply from {c.instructor.name}</p>
                        <p className="mt-1 text-ink-2">{r.instructorReply}</p>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-ink-2">No reviews yet. Learners who finish the course can rate it here.</p>
            )}
          </section>

          {/* Related courses the instructor chose (owner 2026-11-28); nothing is shown when there are none. */}
          <RelatedCourses items={c.related} className="mt-14" intro="Courses that build on what you learn here." />
        </div>

        <aside className="relative hidden lg:block" aria-label="Purchase">
          <div className="sticky top-24 -mt-[300px] pb-10"><PurchaseCard course={c} firstPreviewId={previews[0]?.id} /></div>
        </aside>
      </div>
    </PreviewProvider>
  );
}
