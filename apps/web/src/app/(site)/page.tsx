import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { getCategories, getCourse, getCourses, getFeaturedInstructors } from "@/lib/catalog";
import { CoursePath } from "@/components/home/CoursePath";
import { HeroLoop } from "@/components/HeroLoop";
import { CourseTile, Price } from "@/components/CourseViews";
import { CourseCover } from "@/components/CourseCover";
import { RatingInline } from "@/components/Stars";
import { Avatar } from "@/components/Avatar";
import { categoryIcon } from "@/components/CategoryIcon";
import { hours, levelLabel, plural } from "@/lib/format";
import type { CourseCard, InstructorSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

// Topics the catalogue really covers; e2e checks that each one returns at least one course.
const searches = ["Kubernetes", "MCP", "Amazon Bedrock", "RAG", "Terraform", "n8n"];

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
      <CourseCover slug={c.slug} title={c.title} category={c.category?.name} thumbnailUrl={c.thumbnailUrl} size="lg" />
      <div className="grid gap-x-10 gap-y-4 px-2 pb-2 md:grid-cols-[1fr_auto] md:px-3">
        <div>
        <span className="text-sm font-bold text-violet">Editor’s pick</span>
        <h3 className="mt-2 font-display text-2xl font-extrabold leading-tight text-ink group-hover:text-violet md:text-[1.75rem]">{c.title}</h3>
        <p className="mt-3 text-ink-2">{c.subtitle}</p>
        <p className="mt-4 text-sm text-muted">By {c.instructor.name}</p>
        <div className="mt-2"><RatingInline avg={c.ratingAvg} count={c.ratingCount} /></div>
        </div>
        <div className="flex items-end justify-between gap-4 md:flex-col md:items-end md:justify-end md:text-right">
          <span className="text-sm text-muted">{hours(c.totalDurationSec)} of video<br className="hidden md:block" /><span className="md:hidden">, </span>{levelLabel[c.level]}</span>
          <Price cents={c.priceCents} currency={c.currency} className="text-3xl" />
        </div>
      </div>
    </Link>
  );
}

function RankedRow({ c, rank }: { c: CourseCard; rank?: number }) {
  return (
    <li>
      <Link href={`/courses/${c.slug}`} className={`group grid items-center gap-4 py-4 ${rank ? "grid-cols-[2.2rem_88px_1fr_auto]" : "grid-cols-[88px_1fr_auto]"}`}>
        {rank ? <span className="font-display text-3xl font-extrabold tabular-nums text-line-strong group-hover:text-violet">{rank}</span> : null}
        <CourseCover slug={c.slug} title={c.title} thumbnailUrl={c.thumbnailUrl} size="sm" className="!rounded-lg" />
        <span className="min-w-0">
          <span className="line-clamp-2 font-display font-bold leading-snug text-ink group-hover:text-violet">{c.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted">
            <span className="truncate">{c.instructor.name}</span>
            {c.studentCount ? <span className="tabular-nums">{plural(c.studentCount, "learner")}</span> : null}
          </span>
        </span>
        <Price cents={c.priceCents} currency={c.currency} />
      </Link>
    </li>
  );
}

function InstructorFeature({ i }: { i: InstructorSummary }) {
  // Counts come from /instructors/featured; the bio is the instructor's own text, so it is not shown as a quotation.
  const courses = i.courseCount ?? 0;
  const students = i.studentCount ?? 0;
  return (
    <figure className="flex h-full flex-col border-t-2 border-ink pt-6">
      {i.bio ? <p className="font-display text-xl font-semibold leading-snug text-ink md:text-[1.4rem]">{i.bio}</p> : null}
      <figcaption className="mt-6 flex items-center gap-3">
        <Avatar name={i.name} src={i.avatarUrl} size={48} />
        <span className="min-w-0">
          <Link href={`/instructors/${i.id}`} className="block font-bold text-ink hover:text-violet">{i.name}</Link>
          <span className="block truncate text-sm text-muted">{i.headline ?? "Instructor"}</span>
        </span>
      </figcaption>
      <p className="mt-4 text-sm text-muted">{plural(courses, "course")}{students ? `, ${plural(students, "learner")}` : ""}</p>
    </figure>
  );
}

export default async function Home() {
  const [cats, popular, newest, rated, instructors] = await Promise.all([
    getCategories(),
    getCourses({ sort: "popular", pageSize: 5 }),
    getCourses({ sort: "newest", pageSize: 8 }),
    getCourses({ sort: "rating", pageSize: 3 }),
    getFeaturedInstructors(3),
  ]);
  const all = [...popular.items, ...newest.items, ...rated.items];
  const featured = rated.items[0] ?? popular.items[0];
  const runnersUp = (rated.items.length > 1 ? rated.items.slice(1, 3) : newest.items.filter((c) => c.slug !== featured?.slug).slice(0, 2));
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

  return (
    <>
      {/* Hero: the DEL loop as the learning pipeline */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="container-x grid items-center gap-10 pb-16 pt-12 md:pt-16 lg:grid-cols-[1fr_1.05fr] lg:gap-6 lg:pb-24 lg:pt-20">
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
            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Popular:</span>
              {searches.map((s) => (
                <Link key={s} href={`/courses?q=${encodeURIComponent(s)}`} className="rounded-full border border-line px-3 py-1 font-bold text-ink-2 hover:border-violet hover:text-violet">{s}</Link>
              ))}
            </div>
          </div>
          <HeroLoop spotlight={featured ? { title: featured.title, href: `/courses/${featured.slug}`, meta: `${featured.instructor.name}, ${hours(featured.totalDurationSec)}` } : null} />
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
                <Link key={c.slug} href={`/courses?category=${c.slug}`} className="group flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-surface-2">
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
          <SectionHead title="Start here" sub="Hand-picked courses with the strongest reviews from people who finished them." href="/courses?sort=rating" cta="All top-rated courses" />
          <div className="grid gap-8 lg:grid-cols-[1.9fr_1fr]">
            <Spread c={featured} />
            <div className="grid content-start gap-8 sm:grid-cols-2 lg:grid-cols-1">
              {runnersUp.map((c) => <CourseTile key={c.slug} c={c} />)}
            </div>
          </div>
        </section>
      ) : null}

      {!flagship && popular.items.length ? (
        <section className="container-x pt-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <SectionHead title="Most enrolled" sub="What DevOps teams are learning right now, ranked by enrolments." />
              <Link href="/courses?sort=popular" className="btn btn-outline">Browse all popular courses</Link>
            </div>
            <ol className="divide-y divide-line border-y border-line">
              {popular.items.slice(0, 5).map((c, i) => <RankedRow key={c.slug} c={c} rank={i + 1} />)}
            </ol>
          </div>
        </section>
      ) : null}

      {!flagship && newest.items.length ? (
        <section className="pt-20">
          <div className="container-x"><SectionHead title="New on DEL" sub="Fresh courses, recorded against current tool versions." href="/courses?sort=newest" cta="See all new courses" /></div>
          <div className="container-x">
            <div className="scroll-rail -mx-1 flex gap-6 overflow-x-auto px-1 pb-4">
              {newest.items.map((c) => (
                <div key={c.slug} className="w-[78%] shrink-0 sm:w-[44%] lg:w-[calc(25%-18px)]"><CourseTile c={c} /></div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {instructors.length >= 2 ? (
        <section className="container-x pt-20">
          <SectionHead title="Taught by practitioners" sub="Every instructor is reviewed before they publish, and every course is checked before it goes live." />
          <div className={`grid gap-10 ${instructors.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2 lg:max-w-[66%]"}`}>
            {instructors.map((i) => <InstructorFeature key={i.id} i={i} />)}
          </div>
        </section>
      ) : null}

      {/* Teach band */}
      <section className="container-x pt-24">
        <div className="relative overflow-hidden rounded-panel bg-stage px-6 py-12 text-white md:px-14 md:py-16">
          <svg viewBox="0 0 120 60" className="pointer-events-none absolute -right-24 -top-10 h-[150%] opacity-25" aria-hidden="true" fill="none">
            <path d="M60,30 C48,14 34,8 22,10 C10,12 4,22 4,30 C4,38 10,48 22,50 C34,52 48,46 60,30 C72,46 86,52 98,50 C110,48 116,38 116,30 C116,22 110,12 98,10 C86,8 72,14 60,30" stroke="#9d8fff" strokeWidth="2.5" />
          </svg>
          <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-end">
            <div>
              <h2 className="font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-extrabold leading-tight">You run it in production. Teach it here.</h2>
              <p className="mt-4 max-w-xl text-white/75">Publish your course, keep the price you set, and get paid out through Stripe. We review every course so learners trust what they buy.</p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link href="/teach" className="btn btn-cyan">Become an instructor</Link>
              <Link href="/teach#how" className="btn border border-white/25 text-white hover:bg-white/10">How it works</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
