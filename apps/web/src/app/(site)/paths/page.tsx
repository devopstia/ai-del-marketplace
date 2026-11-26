import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Route } from "lucide-react";
import { getPaths } from "@/lib/paths-server";
import { CourseCover } from "@/components/CourseCover";
import { hours, money, plural } from "@/lib/format";

export const metadata: Metadata = {
  title: "Career paths",
  description: "Step-by-step course paths for DevOps, cloud and AI roles: which courses to take, in what order, and the skills each one gives.",
  alternates: { canonical: "/paths" },
};
export const dynamic = "force-dynamic";

/** Public list of published career paths (docs/CAREER_PATHS.md). No published path: the page doesn't exist (rule 4). */
export default async function PathsPage() {
  const paths = await getPaths();
  if (!paths.length) notFound();
  return (
    <div className="container-x pb-10 pt-8">
      <div className="border-b border-line pb-5">
        <h1 className="font-display text-[clamp(1.9rem,3.6vw,2.8rem)] font-extrabold leading-tight text-ink">Career paths</h1>
        <p className="mt-1 max-w-2xl text-ink-2">Pick the job you are aiming for. Each path lists the courses to take, in order, and the skills you get from each one. Follow it for a weekly plan that fits your time.</p>
      </div>
      <ul className="mt-8 grid gap-6">
        {paths.map((p) => (
          <li key={p.slug}>
            <Link href={`/paths/${p.slug}`} className="group grid gap-6 rounded-panel border border-line bg-surface p-5 transition-colors hover:border-violet md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:p-6" data-testid="path-card">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-bold text-violet"><Route className="size-4" aria-hidden="true" />{plural(p.courseCount, "course")} · {hours(p.totalDurationSec)}</p>
                <h2 className="mt-2 font-display text-[clamp(1.35rem,2.4vw,1.75rem)] font-extrabold leading-tight text-ink group-hover:text-violet">{p.title}</h2>
                {p.summary ? <p className="mt-2 max-w-2xl text-ink-2">{p.summary}</p> : null}
                {p.skills.length ? (
                  <ul className="mt-4 flex flex-wrap gap-2" aria-label="Skills">
                    {p.skills.slice(0, 10).map((s) => <li key={s} className="rounded-full bg-surface-2 px-2.5 py-1 text-sm text-ink-2">{s}</li>)}
                    {p.skills.length > 10 ? <li className="px-1 py-1 text-sm text-muted">+{p.skills.length - 10} more</li> : null}
                  </ul>
                ) : null}
                <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="text-ink-2">All courses today: <b className="text-ink">{money(p.totalPriceCents, p.currency)}</b></span>
                  <span className="link inline-flex items-center gap-1">See the path<ArrowRight className="size-4" aria-hidden="true" /></span>
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 self-center" aria-hidden="true">
                {p.covers.slice(0, 3).map((c, i) => <CourseCover key={i} slug={`${p.slug}-${i}`} title={p.title} thumbnailUrl={c} size="sm" className="!rounded-lg" />)}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
