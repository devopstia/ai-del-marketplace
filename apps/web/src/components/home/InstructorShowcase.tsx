import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { CourseCover, coverSeeds } from "@/components/CourseCover";
import { plural } from "@/lib/format";
import type { CourseCard, InstructorSummary } from "@/lib/types";

const SHOWN = 3;

/** Each instructor with their real, published courses: their work speaks for them, not a bio. */
export function InstructorShowcase({ people }: { people: { i: InstructorSummary; courses: CourseCard[] }[] }) {
  // Rows of three: avoid the covers beside each one and the cover in the same place in the previous card.
  const seeds = coverSeeds(people.flatMap((p) => p.courses.slice(0, SHOWN).map((c) => c.slug)), [1, 2, SHOWN]);
  let s = 0;
  return (
    <div className={`grid grid-cols-1 gap-6 ${people.length >= 2 ? "md:grid-cols-2" : ""}`}>
      {people.map(({ i, courses }) => {
        const total = i.courseCount ?? courses.length;
        return (
          <article key={i.id} className="flex min-w-0 flex-col rounded-panel border border-line bg-surface p-5 sm:p-6">
            <header className="flex items-center gap-3.5">
              <Avatar name={i.name} src={i.avatarUrl} size={48} />
              <div className="min-w-0 flex-1">
                <Link href={`/instructors/${i.id}`} className="block truncate font-display text-lg font-bold text-ink hover:text-violet">{i.name}</Link>
                <p className="truncate text-sm text-muted">{i.headline ?? "Instructor"}</p>
              </div>
              <Link href={`/instructors/${i.id}`} className="link inline-flex shrink-0 items-center gap-1 text-sm" aria-label={`All courses by ${i.name}`}>
                {total > SHOWN ? `All ${total}` : "Profile"}<ArrowRight className="size-4" />
              </Link>
            </header>
            <ul className="mt-5 grid grid-cols-3 gap-3 sm:gap-4">
              {courses.slice(0, SHOWN).map((c) => (
                <li key={c.slug} className="min-w-0">
                  <Link href={`/courses/${c.slug}`} className="group block">
                    <CourseCover slug={c.slug} title={c.title} thumbnailUrl={c.thumbnailUrl} size="sm" seed={seeds[s++]} showTitle={false} className="!rounded-lg transition-transform duration-200 group-hover:-translate-y-0.5" />
                    <span className="mt-2 line-clamp-2 font-display text-[0.85rem] font-bold leading-snug text-ink group-hover:text-violet sm:text-sm">{c.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-auto pt-5 text-sm text-muted">{plural(total, "published course")}</p>
          </article>
        );
      })}
    </div>
  );
}

/** One quiet line inviting practitioners to teach; the full pitch lives on /teach. */
export function TeachInvite() {
  return (
    <div className="flex flex-col gap-4 rounded-panel border border-line bg-surface px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 60" className="hidden h-8 w-16 shrink-0 sm:block" aria-hidden="true" fill="none">
          <path d="M60,30 C48,14 34,8 22,10 C10,12 4,22 4,30 C4,38 10,48 22,50 C34,52 48,46 60,30 C72,46 86,52 98,50 C110,48 116,38 116,30 C116,22 110,12 98,10 C86,8 72,14 60,30" stroke="var(--violet)" strokeWidth="7" strokeLinecap="round" />
        </svg>
        <p className="text-ink-2">
          <span className="font-display font-bold text-ink">You run it in production? Teach it here.</span>{" "}
          Keep the price you set and get paid out through Stripe.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-3">
        <Link href="/teach" className="btn btn-primary">Become an instructor</Link>
        <Link href="/teach#how" className="btn btn-outline">How it works</Link>
      </div>
    </div>
  );
}
