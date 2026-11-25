import Link from "next/link";
import { ArrowUpRight, Award, Clock, CreditCard, FlaskConical, Infinity as InfinityIcon, ListChecks, PlaySquare, RotateCcw } from "lucide-react";
import { getCategories, getCourse, getCourses, getFeaturedInstructors, getTerms } from "@/lib/catalog";
import { CoursePath } from "@/components/home/CoursePath";
import { HomeHero, type HeroCourse } from "@/components/home/HomeHero";
import { PreviewProvider } from "@/components/PreviewContext";
import { courseFacts, findShot, type Shot } from "@/lib/home-media";
import { CourseTile, Price } from "@/components/CourseViews";
import { CourseCover } from "@/components/CourseCover";
import { RatingInline } from "@/components/Stars";
import { Avatar } from "@/components/Avatar";
import { categoryIcon } from "@/components/CategoryIcon";
import { hours, levelLabel, money, plural } from "@/lib/format";
import type { CourseCard, InstructorSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

// Topics the catalogue really covers; e2e checks that each one returns at least one course.
const searches = ["Kubernetes", "MCP", "Amazon Bedrock", "RAG", "Terraform", "n8n"];

function SectionHead({ title, sub, href, cta }: { title: string; sub?: string; href?: string; cta?: string }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        <h2 className="h-section">{title}</h2>
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
  const [cats, popular, newest, rated, instructors, terms] = await Promise.all([
    getCategories(),
    getCourses({ sort: "popular", pageSize: 5 }),
    getCourses({ sort: "newest", pageSize: 8 }),
    getCourses({ sort: "rating", pageSize: 3 }),
    getFeaturedInstructors(3),
    getTerms(),
  ]);
  const all = [...popular.items, ...newest.items, ...rated.items];
  const featured = rated.items[0] ?? popular.items[0];
  const runnersUp = (rated.items.length > 1 ? rated.items.slice(1, 3) : newest.items.filter((c) => c.slug !== featured?.slug).slice(0, 2));
  const offline = !popular.ok && !newest.ok;
  const countFor = (slug: string) => all.filter((c) => c.category?.slug === slug).length;
  // A small catalogue is shown in depth (one course with its route) instead of the same course in three rails.
  // The rails come back on their own once there are enough courses to fill them.
  const SMALL = 4;
  const small = popular.ok && popular.total < SMALL;
  const spotlight = featured ? await getCourse(small && popular.items[0] ? popular.items[0].slug : featured.slug) : null;
  const flagship = small ? spotlight : null;
  const others = flagship ? popular.items.filter((c) => c.slug !== flagship.slug) : [];
  // Only categories that have courses; the strip is hidden until it can show a real choice.
  const liveCats = cats.filter((c) => (c.courseCount ?? countFor(c.slug)) > 0);

  // Hero: the featured course (slide 2) and real frames from its labs (only lessons that exist in its curriculum).
  const sf = spotlight ? courseFacts(spotlight) : null;
  const heroCourse: HeroCourse | null = spotlight && sf ? {
    slug: spotlight.slug,
    title: spotlight.title,
    subtitle: spotlight.subtitle,
    price: money(spotlight.priceCents, spotlight.currency),
    instructor: spotlight.instructor.name,
    thumbnailUrl: spotlight.thumbnailUrl,
    facts: [plural(sf.lessons, "lesson"), hours(spotlight.totalDurationSec), sf.labs ? plural(sf.labs, "lab download") : "", levelLabel[spotlight.level] ?? ""].filter(Boolean),
    previewId: sf.previews[0]?.id ?? null,
    previewLength: sf.previews[0]?.durationSec,
  } : null;
  const shots = (keys: Parameters<typeof findShot>[1][]) => keys.map((k) => findShot(spotlight, k)).filter(Boolean) as Shot[];
  const heroShots = shots(["k8sDoctor", "ragAzure"]);
  const quizShot = sf?.quizzes ? findShot(spotlight, "quiz") : null;
  const labShots = shots(["bedrock", "ragDocker", "n8n"]);

  // Facts under the hero: the featured course's own numbers while there is one course, otherwise catalogue-wide promises.
  const facts: [typeof Clock, string, string][] = flagship && sf ? [
    [PlaySquare, String(sf.lessons), "video lessons"],
    [Clock, hours(flagship.totalDurationSec), "of video"],
    ...(sf.labs ? [[FlaskConical, String(sf.labs), "lab downloads"] as [typeof Clock, string, string]] : []),
    ...(sf.quizzes ? [[ListChecks, String(sf.quizzes), "short quizzes"] as [typeof Clock, string, string]] : []),
    [RotateCcw, "14-day", "refunds"],
    [InfinityIcon, "Lifetime", "access"],
  ] : popular.ok ? [
    [PlaySquare, String(popular.total), popular.total === 1 ? "course" : "courses"],
    [RotateCcw, "14-day", "refunds"],
    [CreditCard, "Stripe", "secure checkout"],
    [InfinityIcon, "Lifetime", "access"],
  ] : [];
  const share = terms?.instructorSharePercent;

  const previews = spotlight ? spotlight.sections.flatMap((s) => s.lectures).filter((l) => l.isPreview) : [];

  return (
    <PreviewProvider courseTitle={spotlight?.title ?? ""} slug={spotlight?.slug ?? ""} previews={previews}>
      <HomeHero course={heroCourse} searches={searches} labShots={heroShots} quizShot={quizShot} />

      {facts.length ? (
        <div className="border-b border-line bg-surface">
          <ul className="container-x grid grid-cols-2 gap-x-6 gap-y-4 py-5 sm:grid-cols-3 lg:flex lg:justify-between" aria-label={flagship ? `${flagship.title} in numbers` : "Buying on DEL"}>
            {facts.map(([I, v, l]) => (
              <li key={l} className="flex items-center gap-3">
                <I className="size-5 shrink-0 text-violet" aria-hidden="true" />
                <span className="text-[0.95rem] leading-tight"><span className="font-display font-bold text-ink">{v}</span> <span className="text-ink-2">{l}</span></span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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

      {flagship ? <CoursePath c={flagship} labShots={labShots} /> : null}

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

      {/* How buying and learning work: the same rules the course page and checkout apply. */}
      {!offline ? (
        <section aria-labelledby="how-title" className="mt-20 border-y border-line bg-surface md:mt-24">
          <div className="container-x py-14 md:py-16">
            <h2 id="how-title" className="h-section">How learning on DEL works</h2>
            <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
              {([
                [PlaySquare, "Watch free lessons", "Preview lessons play right on the course page, no account needed."],
                [CreditCard, "Buy once", "One price per course, paid through Stripe. Refund within 14 days while you’ve watched under 25%."],
                [FlaskConical, "Learn by doing", "Video lessons, short quizzes and lab files you run on your laptop or your own cloud account."],
                [Award, "Get your certificate", "Finish the course to get a certificate anyone can verify online."],
              ] as const).map(([I, t, d], k) => (
                <li key={t} className="relative">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-full bg-violet-soft text-violet"><I className="size-[18px]" aria-hidden="true" /></span>
                    <span className="text-xs font-bold tabular-nums text-muted">Step {k + 1}</span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-ink">{t}</h3>
                  <p className="mt-1.5 text-[0.95rem] text-ink-2">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {/* Teach on DEL: real terms from /platform/terms, kept quieter than the learner content. */}
      <section aria-labelledby="teach-title" className="container-x pt-16 md:pt-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-16">
          <div>
            <p className="eyebrow">Teach on DEL</p>
            <h2 id="teach-title" className="h-section mt-2">Teach what you run in production</h2>
            <p className="mt-3 max-w-lg text-ink-2">Publish a course, set your own price and get paid through Stripe. We review every course before it goes live, so learners can trust what they buy.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/teach" className="btn btn-primary">Become an instructor</Link>
              <Link href="/teach#how" className="btn btn-outline">How it works</Link>
            </div>
          </div>
          <dl className="grid gap-px overflow-hidden rounded-panel bg-line ring-1 ring-line sm:grid-cols-3">
            {([
              ...(share ? [[`${share}%`, "of each sale is yours, after Stripe’s processing fee"]] : []),
              ["Stripe", "payouts to your own connected account"],
              ["Reviewed", "every course is checked before it’s listed"],
            ] as [string, string][]).map(([v, l]) => (
              <div key={v} className="flex flex-col-reverse justify-end bg-surface p-6">
                <dd className="mt-1 text-sm text-ink-2">{l}</dd>
                <dt className="font-display text-2xl font-bold text-ink">{v}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </PreviewProvider>
  );
}
