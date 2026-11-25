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
          <div className="flex flex-col border-b border-line bg-surface-2/40 p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <p className="flex items-center gap-2 text-sm font-bold text-cyan-ink"><MonitorPlay className="size-4" aria-hidden="true" />On this marketplace</p>
            <h3 className="mt-3 font-display text-[clamp(1.4rem,2.4vw,1.85rem)] font-extrabold leading-tight text-ink">Learn one topic at a time with individual courses.</h3>
            <p className="mt-2 text-ink-2">Choose the skill you need now and learn it at your own pace.</p>
            <ul className="mt-4 grid gap-y-2 text-sm text-ink-2">
              {["Video lessons recorded on real systems", "Lab files for every lesson, plus the full course package", "12 months of access, quizzes and a certificate", "Pay here at checkout; refunds within 14 days"].map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-mint" aria-hidden="true" />{f}</li>)}
            </ul>
            <div className="mt-6 lg:mt-auto lg:pt-6"><Link href="/courses" className="btn btn-outline">Browse courses<ArrowUpRight className="size-4" aria-hidden="true" /></Link></div>
          </div>
          <div className="flex flex-col p-6 sm:p-8">
            <p className="flex items-center gap-2 text-sm font-bold text-violet"><Users className="size-4" aria-hidden="true" />DevOps Easy Learning</p>
            <h2 id="full-program" className="mt-3 font-display text-[clamp(1.4rem,2.4vw,1.85rem)] font-extrabold leading-tight text-ink">
              Want the whole path? Join the full training program.
            </h2>
            <p className="mt-2 text-ink-2"><b className="text-ink">{DEL_PROGRAM.name}</b>: a structured program with live classes and mentors, from zero IT background to job-ready.</p>
            <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm text-ink-2 sm:grid-cols-2">
              {DEL_PROGRAM.facts.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-mint" aria-hidden="true" />{f}</li>)}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2 lg:mt-auto lg:pt-6">
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
