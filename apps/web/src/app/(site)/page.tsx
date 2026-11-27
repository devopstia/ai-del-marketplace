import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { getCategories, getCourse, getCourses, getFeaturedInstructors, getInstructor } from "@/lib/catalog";
import { InstructorShowcase, TeachInvite } from "@/components/home/InstructorShowcase";
import { CoursePath } from "@/components/home/CoursePath";
import { HeroLoop } from "@/components/HeroLoop";
import { FullProgram } from "@/components/promo/FullProgram";
import { PathsBand } from "@/components/paths/PathsBand";
import { getPaths } from "@/lib/paths-server";
import { CourseBadges, CourseTile, MIN_STUDENTS_SHOWN, Price } from "@/components/CourseViews";
import { CourseCover, coverSeeds } from "@/components/CourseCover";
import { categoryIcon } from "@/components/CategoryIcon";
import { hours, levelLabel, plural } from "@/lib/format";
import type { CourseCard } from "@/lib/types";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { organizationLd, pageMeta, topicPath, websiteLd } from "@/lib/seo";
import { siteShare } from "@/lib/share-server";
import { courseBy } from "@/lib/brand";

export const dynamic = "force-dynamic";

/** Title, description and sharing banner from Super Admin › Social Media & Sharing (docs/SOCIAL_SHARING.md). */
export async function generateMetadata(): Promise<Metadata> {
  const share = await siteShare();
  return {
    ...pageMeta({ title: share.title, description: share.description, path: "/", image: share.image }),
    title: { absolute: share.title },
  };
}


function SectionHead({ title, sub, href, cta }: { title: string; sub?: string; href?: string; cta?: string }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        <h2 className="font-display text-[clamp(1.5rem,2.6vw,2.1rem)] font-extrabold text-ink">{title}</h2>
        {sub ? <p className="mt-2 text-ink-2">{sub}</p> : null}
      </div>
      {href ? <Link href={href} className="link inline-flex items-center gap-1 text-sm">{cta}<ArrowUpRight className="size-4" /></Link> : null}
    </div>
  );
}

function Spread({ c }: { c: CourseCard }) {
  return (
    <Link href={`/courses/${c.slug}`} className="group grid gap-5 rounded-panel bg-surface p-3 ring-1 ring-line transition-shadow hover:shadow-float md:p-4">
      <CourseCover slug={c.slug} title={c.title} category={c.category?.name} thumbnailUrl={c.thumbnailUrl} size="lg" showTitle={false} />
      <div className="grid gap-x-10 gap-y-4 px-2 pb-2 md:grid-cols-[1fr_auto] md:px-3">
        <div>
        <span className="text-sm font-bold text-violet">Our pick to start with</span>
        <h3 className="mt-2 font-display text-2xl font-extrabold leading-tight text-ink group-hover:text-violet md:text-[1.75rem]">{c.title}</h3>
        <p className="mt-3 text-ink-2">{c.subtitle}</p>
        <p className="mt-4 text-sm text-muted">By {courseBy(c.instructor)}</p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm"><CourseBadges c={c} /></p>
        </div>
        <div className="flex items-end justify-between gap-4 md:flex-col md:items-end md:justify-end md:text-right">
          <span className="text-sm text-muted">{hours(c.totalDurationSec)} of lessons<br className="hidden md:block" /><span className="md:hidden">, </span>{levelLabel[c.level]}</span>
          <Price cents={c.priceCents} listCents={c.listPriceCents} currency={c.currency} className="text-3xl" />
        </div>
      </div>
    </Link>
  );
}

function RankedRow({ c, rank, fill = false }: { c: CourseCard; rank?: number; fill?: boolean }) {
  return (
    <li className={fill ? "flex flex-1 items-center" : undefined}>
      <Link href={`/courses/${c.slug}`} className={`group grid w-full items-center gap-4 py-4 ${rank ? "grid-cols-[2.2rem_88px_1fr_auto]" : "grid-cols-[88px_1fr_auto]"}`}>
        {rank ? <span className="font-display text-3xl font-extrabold tabular-nums text-muted group-hover:text-violet">{rank}</span> : null}
        <CourseCover slug={c.slug} title={c.title} thumbnailUrl={c.thumbnailUrl} size="sm" showTitle={false} className="!rounded-lg" />
        <span className="min-w-0">
          <span className="line-clamp-2 font-display font-bold leading-snug text-ink group-hover:text-violet">{c.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted">
            <span className="truncate">{courseBy(c.instructor)}</span>
            {c.studentCount >= MIN_STUDENTS_SHOWN ? <span className="tabular-nums">{plural(c.studentCount, "learner")}</span> : null}
          </span>
        </span>
        <Price cents={c.priceCents} listCents={c.listPriceCents} currency={c.currency} />
      </Link>
    </li>
  );
}

export default async function Home() {
  const [cats, popular, newest, rated, instructors, paths] = await Promise.all([
    getCategories(),
    getCourses({ sort: "popular", pageSize: 5 }),
    getCourses({ sort: "newest", pageSize: 8 }),
    getCourses({ sort: "rating", pageSize: 3 }),
    getFeaturedInstructors(3),
    getPaths(),
  ]);
  const all = [...popular.items, ...newest.items, ...rated.items];
  const featured = rated.items[0] ?? popular.items[0];
  const runnersUp = (rated.items.length > 1 ? rated.items.slice(1, 3) : newest.items.filter((c) => c.slug !== featured?.slug).slice(0, 2));
  // "Most enrolled" only ranks what learners really chose: it needs three courses with learners.
  const enrolled = popular.items.filter((c) => c.studentCount > 0);
  const newSeeds = coverSeeds(newest.items.map((c) => c.slug));
  const pickSeeds = coverSeeds([featured?.slug ?? "", ...runnersUp.map((c) => c.slug)]).slice(1);
  const offline = !popular.ok && !newest.ok;
  const countFor = (slug: string) => all.filter((c) => c.category?.slug === slug).length;
  // A small catalogue is shown in depth (one course as a route) instead of the same course in three rails.
  // The rails come back on their own once there are enough courses to fill them.
  const SMALL = 4;
  const small = popular.ok && popular.total < SMALL;
  const flagship = small && popular.items[0] ? await getCourse(popular.items[0].slug) : null;
  const others = flagship ? popular.items.filter((c) => c.slug !== flagship.slug) : [];
  // Only categories that have courses; the strip is hidden until it can show a real choice.
  const liveCats = cats.filter((c) => (c.courseCount ?? countFor(c.slug)) > 0);
  // Each featured instructor with their published courses (their profile lists them).
  const people = (await Promise.all(instructors.map(async (i) => ({ i, courses: (await getInstructor(i.id))?.courses ?? [] }))))
    .filter((p) => p.courses.length);

  return (
    <>
      <JsonLd data={organizationLd()} />
      <JsonLd data={websiteLd()} />
      {/* Hero: the DEL loop as the learning pipeline */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="container-x grid items-center gap-10 pb-16 pt-12 lg:items-stretch md:pt-16 lg:grid-cols-[1fr_1.05fr] lg:gap-6 lg:pb-24 lg:pt-20">
          <div className="max-w-xl">
            <h1 className="font-display text-[clamp(2.35rem,5.4vw,4.1rem)] font-extrabold leading-[1.02] tracking-[-0.035em] text-ink">
              Learn AI and DevOps the way production works.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-ink-2">
              Courses from engineers who build and run these systems. Every lesson ends with a lab you can run on your laptop or your own cloud account.
            </p>
            <form action="/courses" role="search" className="mt-8 flex max-w-lg items-center gap-2 rounded-full border-[1.5px] border-line-strong bg-surface p-1.5 pl-5 shadow-lift focus-within:border-violet">
              <Search className="size-5 shrink-0 text-muted" aria-hidden="true" />
              <input name="q" type="search" aria-label="Search courses" placeholder="What do you want to build?" className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted focus:outline-none" />
              <button className="btn btn-primary !rounded-full">Search</button>
            </form>
          </div>
          <HeroLoop spotlight={featured ? { slug: featured.slug, thumbnailUrl: featured.thumbnailUrl, ratingAvg: featured.ratingAvg, ratingCount: featured.ratingCount, priceCents: featured.priceCents, listPriceCents: featured.listPriceCents, currency: featured.currency, title: featured.title, href: `/courses/${featured.slug}`, meta: `${featured.instructor.name}, ${hours(featured.totalDurationSec)}` } : null} />
        </div>
      </section>

      {/* Category index */}
      {liveCats.length >= 3 ? (
        <nav aria-label="Categories" className="border-b border-line bg-surface">
          <div className="container-x scroll-rail flex gap-1 overflow-x-auto py-3 lg:justify-between">
            {liveCats.map((c) => {
              const I = categoryIcon(c.slug, c.icon);
              const n = c.courseCount ?? countFor(c.slug);
              return (
                <Link key={c.slug} href={topicPath(c.slug)} className="group flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-surface-2">
                  <I className="size-5 text-violet" aria-hidden="true" />
                  <span className="font-bold text-ink">{c.name}</span>
                  {n ? <span className="text-sm tabular-nums text-muted">{n}</span> : null}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}

      {offline ? (
        <section className="container-x py-20">
          <div className="panel mx-auto max-w-xl p-8 text-center">
            <h2 className="font-display text-2xl font-bold">The course catalogue is offline</h2>
            <p className="mt-2 text-ink-2">We can’t reach the course service right now. Refresh in a minute; your purchases and progress are safe.</p>
          </div>
        </section>
      ) : null}

      {flagship ? <CoursePath c={flagship} /> : null}

      {others.length ? (
        <section className="container-x pt-16">
          <SectionHead title="More courses on DEL" sub="From independent instructors, reviewed before they go live." href="/courses" cta="Browse all courses" />
          <ol className="divide-y divide-line border-y border-line lg:max-w-4xl">
            {others.map((c) => <RankedRow key={c.slug} c={c} />)}
          </ol>
        </section>
      ) : null}

      {!flagship && featured ? (
        <section className="container-x pt-16 md:pt-20">
          <SectionHead title="Start here" sub="Where we suggest beginning, and two more courses worth a look." href="/courses" cta="Browse all courses" />
          <div className="grid gap-8 lg:grid-cols-[1.9fr_1fr]">
            <Spread c={featured} />
            <div className="grid content-start gap-8 sm:grid-cols-2 lg:grid-cols-1">
              {runnersUp.map((c, i) => <CourseTile key={c.slug} c={c} coverSeed={pickSeeds[i]} />)}
            </div>
          </div>
        </section>
      ) : null}

      {!flagship && enrolled.length >= 3 ? (
        <section className="container-x pt-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
            <div className="flex flex-col">
              <SectionHead title="Most enrolled" sub="What DevOps teams are learning right now, ranked by enrolments." />
              {/* the number one course fills the column beside the ranking */}
              <Link href={`/courses/${enrolled[0]!.slug}`} className="group block rounded-panel border border-line bg-surface p-3 transition-colors hover:border-violet">
                <CourseCover slug={enrolled[0]!.slug} title={enrolled[0]!.title} category={enrolled[0]!.category?.name} thumbnailUrl={enrolled[0]!.thumbnailUrl} showTitle={false} />
                <span className="mt-3 flex items-baseline gap-3 px-1"><span className="font-display text-3xl font-extrabold text-violet">1</span><span className="min-w-0 font-display font-bold leading-snug text-ink group-hover:text-violet">{enrolled[0]!.title}</span></span>
                <span className="mt-1 block px-1 pb-1 text-sm text-muted">{courseBy(enrolled[0]!.instructor)}{enrolled[0]!.studentCount >= MIN_STUDENTS_SHOWN ? ` · ${plural(enrolled[0]!.studentCount, "learner")}` : ""}</span>
              </Link>
              <Link href="/courses?sort=popular" className="btn btn-outline mt-5 self-start">Browse all popular courses</Link>
            </div>
            {/* the ranking spans the full height of the #1 card beside it: no empty space under the list */}
            <ol className="flex flex-col divide-y divide-line border-y border-line lg:mt-[5.5rem]">
              {enrolled.slice(1, 6).map((c, i) => <RankedRow key={c.slug} c={c} rank={i + 2} fill />)}
            </ol>
          </div>
        </section>
      ) : null}

      {!flagship && newest.items.length ? (
        <section className="pt-20">
          <div className="container-x"><SectionHead title="New on DEL" sub="Fresh courses, recorded against current tool versions." href="/courses?sort=newest" cta="See all new courses" /></div>
          <div className="container-x">
            <div className="scroll-rail -mx-1 flex gap-6 overflow-x-auto px-1 pb-4">
              {newest.items.map((c, i) => (
                <div key={c.slug} className="w-[78%] shrink-0 sm:w-[44%] lg:w-[calc(25%-18px)]"><CourseTile c={c} coverSeed={newSeeds[i]} /></div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {!offline ? <PathsBand paths={paths} /> : null}

      {!offline ? <FullProgram /> : null}

      {people.length ? (
        <section className="container-x pb-4 pt-20">
          <SectionHead title="Learn from the people who build it" sub="Every instructor is reviewed before they publish, and every course is checked before it goes live." />
          <InstructorShowcase people={people} />
          <div className="mt-6"><TeachInvite /></div>
        </section>
      ) : (
        <section className="container-x pb-4 pt-20"><TeachInvite /></section>
      )}
    </>
  );
}
