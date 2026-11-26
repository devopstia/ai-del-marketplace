import Link from "next/link";
import { ArrowUpRight, Route } from "lucide-react";
import type { PathSummary } from "@/lib/paths";
import { hours, plural } from "@/lib/format";

/**
 * Homepage band for career paths (docs/CAREER_PATHS.md). Rendered only when at least one path is published, so the
 * homepage is unchanged until then. Up to three paths; the rest are on /paths.
 */
export function PathsBand({ paths }: { paths: PathSummary[] }) {
  if (!paths.length) return null;
  const shown = paths.slice(0, 3);
  return (
    <section className="container-x pt-20" aria-labelledby="career-paths" data-testid="paths-band">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="career-paths" className="font-display text-[clamp(1.5rem,2.6vw,2rem)] font-extrabold leading-tight text-ink">Not sure where to start? Follow a career path.</h2>
          <p className="mt-1 max-w-2xl text-ink-2">The courses for a role, in order, with the skills each one gives and a weekly plan that fits your time.</p>
        </div>
        <Link href="/paths" className="link inline-flex items-center gap-1 text-sm">All career paths<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
      </div>
      <ul className={`mt-6 grid gap-4 ${shown.length === 1 ? "" : shown.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        {shown.map((p) => (
          <li key={p.slug}>
            <Link href={`/paths/${p.slug}`} className="group flex h-full flex-col rounded-panel border border-line bg-surface p-5 transition-colors hover:border-violet">
              <p className="flex items-center gap-2 text-sm font-bold text-violet"><Route className="size-4" aria-hidden="true" />{plural(p.courseCount, "course")} · {hours(p.totalDurationSec)}</p>
              <h3 className="mt-2 font-display text-xl font-bold leading-snug text-ink group-hover:text-violet">{p.title}</h3>
              {p.summary ? <p className="mt-1.5 line-clamp-3 text-sm text-ink-2">{p.summary}</p> : null}
              {p.skills.length ? <p className="mt-auto pt-4 text-sm text-muted">{p.skills.slice(0, 5).join(" · ")}</p> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
