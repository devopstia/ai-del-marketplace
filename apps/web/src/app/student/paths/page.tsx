"use client";
import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Check, CircleDashed, Clock3, Loader2, PlayCircle, Route, ShoppingCart } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { list, obj } from "@/lib/normalize";
import { date, money } from "@/lib/format";
import { HOURS_CHOICES, studyTime, toMyPath, type MyPath, type SkillState } from "@/lib/paths";
import { LoopMeter } from "@/components/LoopMeter";
import { Empty, Skeleton } from "@/components/Empty";
import { DataTable, Kpis, PageHead } from "@/components/shell/AppShell";
import { useToast } from "@/components/Toast";

const map = (r: unknown) => ({ items: list(obj(r).items).map(toMyPath), available: Number(obj(r).available ?? 0) });

const SKILL: Record<SkillState, { label: string; cls: string; icon: typeof Check }> = {
  done: { label: "Done", cls: "bg-mint-soft text-mint", icon: Check },
  in_progress: { label: "In progress", cls: "bg-amber-soft text-amber", icon: Clock3 },
  needed: { label: "Still needed", cls: "bg-surface-2 text-ink-2", icon: CircleDashed },
};

/** Student Studio › Career paths: the paths this student follows, with real progress, a weekly plan and a skill map. */
export default function MyPathsPage() {
  const { data, error, reload, setData } = useApi("/me/paths", map);
  return (
    <div className="max-w-[1600px]">
      <PageHead title="Career paths" sub="Your plan for each path you follow: what to study this week, when you will finish at your pace, and the skills you have so far." />
      {error ? <p className="text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="h-96" /> : null}
      {data && !data.items.length ? (
        <Empty icon={Route} title="You don't follow a path yet" body="A career path lists the courses for a role, in order. Follow one to get a weekly plan that fits your time." href="/paths" cta="See career paths" />
      ) : null}
      {data?.items.map((p) => (
        <PathPlan key={p.path.slug} p={p} onChange={(next) => setData({ ...data, items: data.items.map((x) => (x.path.slug === next.path.slug ? next : x)) })} onLeft={reload} />
      ))}
    </div>
  );
}

function PathPlan({ p, onChange, onLeft }: { p: MyPath; onChange: (p: MyPath) => void; onLeft: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const slug = encodeURIComponent(p.path.slug);
  async function setHours(h: number) {
    setBusy(true);
    try { onChange(toMyPath(await api(`/me/paths/${slug}`, { method: "PUT", body: { hoursPerWeek: h } }))); } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }
  async function leave() {
    if (!confirm(`Stop following ${p.path.title}? Your course progress stays.`)) return;
    try { await api(`/me/paths/${slug}`, { method: "DELETE" }); toast("ok", "You no longer follow this path."); onLeft(); } catch (e) { toast("error", errMsg(e)); }
  }
  const plan = p.plan;
  const done = !plan.finishOn && p.progress.lectureCount > 0;
  const groups = (["done", "in_progress", "needed"] as SkillState[]).map((k) => ({ k, skills: p.skills.filter((s) => s.state === k) })).filter((g) => g.skills.length);

  return (
    <section className="mb-12" aria-labelledby={`path-${p.path.slug}`} data-testid="my-path">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`path-${p.path.slug}`} className="font-display text-2xl font-extrabold leading-tight">{p.path.title}</h2>
          <Link href={`/paths/${p.path.slug}`} className="link text-sm">See the path page</Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`hours-${p.path.slug}`} className="text-sm text-ink-2">I can study</label>
          <select id={`hours-${p.path.slug}`} className="field !w-auto" value={p.hoursPerWeek} disabled={busy} onChange={(e) => void setHours(Number(e.target.value))}>
            {[...new Set([...HOURS_CHOICES, p.hoursPerWeek])].sort((a, b) => a - b).map((h) => <option key={h} value={h}>{h} hours a week</option>)}
          </select>
          {busy ? <Loader2 className="size-4 animate-spin text-muted" aria-label="Saving" /> : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void leave()}>Stop following</button>
        </div>
      </div>

      <Kpis items={[
        { label: "Courses completed", value: `${p.progress.coursesDone} / ${p.progress.courseCount}` },
        { label: "Lessons completed", value: `${p.progress.lecturesDone} / ${p.progress.lectureCount}` },
        { label: "Study time left", value: plan.remainingSec ? studyTime(plan.remainingSec) : "None", note: "Unique time watched is counted, replays aren't" },
        { label: "Estimated finish", value: plan.finishOn ? date(plan.finishOn) : done ? "Finished" : "–", note: plan.finishOn ? `At ${p.hoursPerWeek} hours a week, about ${plan.weeks} ${plan.weeks === 1 ? "week" : "weeks"}` : undefined },
      ]} />

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="rounded-panel border border-line bg-surface p-5">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold"><CalendarDays className="size-5 text-violet" aria-hidden="true" />This week</h3>
          {plan.thisWeek.length ? (
            <>
              <p className="mt-1 text-sm text-ink-2">{studyTime(plan.thisWeekSec)} of your {p.hoursPerWeek} hours, in path order.</p>
              <ol className="mt-4 divide-y divide-line">
                {plan.thisWeek.map((w) => (
                  <li key={w.lectureId}>
                    <Link href={`/learn/${w.courseSlug}/${w.lectureId}`} className="group flex items-start gap-3 py-3">
                      <PlayCircle className="mt-0.5 size-5 shrink-0 text-violet" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold leading-snug group-hover:text-violet">{w.title}</span>
                        <span className="block truncate text-sm text-muted">{w.courseTitle}</span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-sm tabular-nums text-ink-2">{w.remainingSec ? studyTime(w.remainingSec) : ""}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </>
          ) : !plan.blockedBy ? (
            <p className="mt-2 text-ink-2">{done ? "You have completed every course in this path." : "Nothing to plan yet."}</p>
          ) : null}
          {plan.blockedBy ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-tile border border-line bg-surface-2/50 p-4" data-testid="path-next-course">
              <ShoppingCart className="size-5 shrink-0 text-violet" aria-hidden="true" />
              <p className="min-w-0 flex-1 text-sm text-ink-2">{plan.thisWeek.length ? "After these lessons, the path continues with" : "The next course in the path is"} <b className="text-ink">{plan.blockedBy.title}</b>.</p>
              <Link href={`/courses/${plan.blockedBy.slug}`} className="btn btn-outline btn-sm">See the course</Link>
            </div>
          ) : null}
        </div>

        <div className="rounded-panel border border-line bg-surface p-5">
          <h3 className="font-display text-lg font-bold">Skill map</h3>
          {groups.length ? (
            <div className="mt-3 grid gap-4">
              {groups.map((g) => {
                const S = SKILL[g.k];
                return (
                  <div key={g.k}>
                    <p className="text-sm font-bold text-ink-2">{S.label} <span className="font-normal text-muted">({g.skills.length})</span></p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {g.skills.map((s) => <li key={s.skill} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold ${S.cls}`}><S.icon className="size-3.5" aria-hidden="true" />{s.skill}</li>)}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : <p className="mt-2 text-sm text-ink-2">This path doesn&apos;t list skills yet.</p>}
          <p className="mt-4 text-xs text-muted">A skill is done when you complete a course that teaches it.</p>
        </div>
      </div>

      <div className="mt-6">
        <DataTable head={["Step", "Course", "Progress", "Access", ""]} min={720}>
          {p.steps.map((s) => (
            <tr key={s.course.slug}>
              <td className="px-4 py-3.5 font-display font-extrabold tabular-nums text-violet">{s.position}</td>
              <td className="px-4 py-3.5"><Link href={`/courses/${s.course.slug}`} className="font-bold hover:text-violet">{s.course.title}</Link><p className="text-xs text-muted">{s.course.instructor.name}</p></td>
              <td className="px-4 py-3.5"><span className="inline-flex items-center gap-3"><LoopMeter value={s.progress.percent} size="sm" /><span className="text-sm tabular-nums text-ink-2">{s.progress.completed} of {s.progress.total}</span></span></td>
              <td className="px-4 py-3.5 text-sm">
                {s.access === "owned" ? <span className="font-bold text-mint">In your courses</span> : s.access === "expired" ? <span className="text-amber">Access ended</span> : <span className="text-ink-2">Not bought yet · {money(s.course.priceCents, s.course.currency)}</span>}
              </td>
              <td className="px-4 py-3.5 text-right">
                {s.certificateCode ? <Link href={`/certificates/${s.certificateCode}`} className="btn btn-ghost btn-sm">Certificate</Link>
                  : s.access === "owned" ? <Link href={`/learn/${s.course.slug}`} className="btn btn-ghost btn-sm">{s.progress.percent ? "Continue" : "Start"}</Link>
                  : <Link href={`/courses/${s.course.slug}`} className="btn btn-ghost btn-sm">{s.access === "expired" ? "Renew" : "View course"}</Link>}
              </td>
            </tr>
          ))}
        </DataTable>
        {p.remainingPriceCents ? <p className="mt-3 text-sm text-ink-2">Courses still to buy for this path: <b className="text-ink">{money(p.remainingPriceCents)}</b> at today&apos;s prices.</p> : null}
      </div>
    </section>
  );
}
