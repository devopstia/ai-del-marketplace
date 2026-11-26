import { img, list, obj, strs, toCourseCard } from "./normalize";
import type { CourseCard } from "./types";

/** Career paths (owner 2026-11-26, idea 4; docs/CAREER_PATHS.md): shapes from the API and their normalizers. */

export interface PathStep { position: number; skills: string[]; note: string; course: CourseCard }
export interface PathSummary {
  id: string; slug: string; title: string; summary: string;
  courseCount: number; totalDurationSec: number; totalPriceCents: number; currency: string; skills: string[];
  covers: (string | null)[];
}
export interface PathDetail extends Omit<PathSummary, "covers"> { description: string; steps: PathStep[]; updatedAt: string | null }

export type SkillState = "done" | "in_progress" | "needed";
export interface MyPathStep extends PathStep {
  access: "owned" | "expired" | "none";
  progress: { total: number; completed: number; percent: number };
  certificateCode: string | null;
}
export interface WeekItem { lectureId: string; title: string; courseSlug: string; courseTitle: string; remainingSec: number }
export interface MyPath {
  path: { id: string; slug: string; title: string; summary: string };
  hoursPerWeek: number;
  progress: { coursesDone: number; courseCount: number; lecturesDone: number; lectureCount: number };
  remainingPriceCents: number;
  steps: MyPathStep[];
  plan: { hoursPerWeek: number; remainingSec: number; weeks: number; finishOn: string | null; thisWeek: WeekItem[]; thisWeekSec: number; blockedBy: { slug: string; title: string } | null };
  skills: { skill: string; state: SkillState }[];
}

const s = (x: unknown, d = "") => (typeof x === "string" ? x : d);
const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);

function toStep(x: unknown): PathStep {
  const o = obj(x);
  return { position: n(o.position), skills: strs(o.skills), note: s(o.note), course: toCourseCard(o.course) };
}

export function toPathSummary(x: unknown): PathSummary {
  const o = obj(x);
  return {
    id: s(o.id), slug: s(o.slug), title: s(o.title), summary: s(o.summary),
    courseCount: n(o.courseCount), totalDurationSec: n(o.totalDurationSec), totalPriceCents: n(o.totalPriceCents), currency: s(o.currency, "usd"),
    skills: strs(o.skills), covers: list(o.covers).map(img),
  };
}

export function toPathDetail(x: unknown): PathDetail {
  const o = obj(x);
  const base: Partial<PathSummary> = toPathSummary(o);
  delete base.covers;
  return { ...(base as Omit<PathSummary, "covers">), description: s(o.description), updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null, steps: list(o.steps).map(toStep) };
}

export function toMyPath(x: unknown): MyPath {
  const o = obj(x);
  const p = obj(o.path);
  const pr = obj(o.progress);
  const plan = obj(o.plan);
  const blocked = obj(plan.blockedBy);
  return {
    path: { id: s(p.id), slug: s(p.slug), title: s(p.title), summary: s(p.summary) },
    hoursPerWeek: n(o.hoursPerWeek) || 5,
    progress: { coursesDone: n(pr.coursesDone), courseCount: n(pr.courseCount), lecturesDone: n(pr.lecturesDone), lectureCount: n(pr.lectureCount) },
    remainingPriceCents: n(o.remainingPriceCents),
    steps: list(o.steps).map((st) => {
      const so = obj(st);
      const g = obj(so.progress);
      const access = so.access === "owned" || so.access === "expired" ? so.access : "none";
      return { ...toStep(st), access, progress: { total: n(g.total), completed: n(g.completed), percent: n(g.percent) }, certificateCode: typeof so.certificateCode === "string" ? so.certificateCode : null };
    }),
    plan: {
      hoursPerWeek: n(plan.hoursPerWeek), remainingSec: n(plan.remainingSec), weeks: n(plan.weeks), finishOn: typeof plan.finishOn === "string" ? plan.finishOn : null,
      thisWeek: list(plan.thisWeek).map((w) => { const q = obj(w); return { lectureId: s(q.lectureId), title: s(q.title), courseSlug: s(q.courseSlug), courseTitle: s(q.courseTitle), remainingSec: n(q.remainingSec) }; }),
      thisWeekSec: n(plan.thisWeekSec),
      blockedBy: blocked.slug ? { slug: s(blocked.slug), title: s(blocked.title) } : null,
    },
    skills: list(o.skills).map((k) => { const q = obj(k); return { skill: s(q.skill), state: (q.state === "done" || q.state === "in_progress" ? q.state : "needed") as SkillState }; }),
  };
}

export const HOURS_CHOICES = [2, 3, 5, 8, 10, 15, 20];

/** "about 3 h 20 min" style length for study time. */
export function studyTime(sec: number) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${Math.max(1, m)} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
