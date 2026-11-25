import Link from "next/link";
import { ArrowUpRight, Check, MonitorPlay, Users } from "lucide-react";
import { DEL_PROGRAM, programLink } from "@/lib/del-program";

const ext = { target: "_blank", rel: "noopener" } as const;

/**
 * Homepage band: the two ways to learn with DEL. Individual courses are bought here; the full program is a separate
 * enrolment on devopseasylearning.com (its own form and payment).
 */
export function FullProgram() {
  return (
    <section className="container-x pt-20" aria-labelledby="full-program" data-testid="full-program">
      <div className="overflow-hidden rounded-panel border border-line bg-surface">
        <div className="grid lg:grid-cols-[1fr_1.35fr]">
          <div className="border-b border-line p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <p className="flex items-center gap-2 text-sm font-bold text-cyan-ink"><MonitorPlay className="size-4" aria-hidden="true" />On this marketplace</p>
            <h3 className="mt-3 font-display text-xl font-extrabold text-ink">Individual courses</h3>
            <p className="mt-2 text-ink-2">Pick one topic and learn it at your own pace: video lessons, lab files for every lesson and 12 months of access. You pay here, at checkout.</p>
            <Link href="/courses" className="link mt-5 inline-flex items-center gap-1 text-sm">Browse courses<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
          </div>
          <div className="p-6 sm:p-8">
            <p className="flex items-center gap-2 text-sm font-bold text-violet"><Users className="size-4" aria-hidden="true" />DevOps Easy Learning</p>
            <h2 id="full-program" className="mt-3 font-display text-[clamp(1.4rem,2.4vw,1.85rem)] font-extrabold leading-tight text-ink">
              Want the whole path? Join the full training program.
            </h2>
            <p className="mt-2 text-ink-2"><b className="text-ink">{DEL_PROGRAM.name}</b>: a structured program with live classes and mentors, from zero IT background to job-ready.</p>
            <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm text-ink-2 sm:grid-cols-2">
              {DEL_PROGRAM.facts.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-mint" aria-hidden="true" />{f}</li>)}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              <a {...ext} href={programLink(DEL_PROGRAM.enrollUrl, "home")} className="btn btn-primary" data-testid="program-enroll">Enroll in the full training program<ArrowUpRight className="size-4" aria-hidden="true" /></a>
              <a {...ext} href={programLink(DEL_PROGRAM.aboutUrl, "home")} className="btn btn-outline">Explore the program</a>
            </div>
            <p className="mt-3 text-xs text-muted">Enrolment and payment for the program happen on devopseasylearning.com. Opens in a new tab.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Small note for course pages: the course belongs to a bigger path. */
export function ProgramNote({ placement }: { placement: string }) {
  return (
    <aside className="rounded-tile border border-line bg-surface p-5" aria-label="Full training program" data-testid="program-note">
      <p className="text-sm font-bold text-violet">Prefer a guided path?</p>
      <p className="mt-1 text-sm text-ink-2">This course is part of what DEL teaches in the <b className="text-ink">{DEL_PROGRAM.name}</b> program: 8 months of live classes, projects and an internship.</p>
      <a {...ext} href={programLink(DEL_PROGRAM.aboutUrl, placement)} className="link mt-3 inline-flex items-center gap-1 text-sm">Join our complete training program<ArrowUpRight className="size-4" aria-hidden="true" /></a>
    </aside>
  );
}
