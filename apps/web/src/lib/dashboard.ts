import { obj, list, img } from "./normalize";

/** GET /instructor/dashboard (apps/api/src/instructor/dashboard.service.ts), mapped defensively. */
export type Ownership = "platform" | "del_agreement" | "revenue_share";
export interface PeriodMoney { grossCents: number; feesCents: number; refundsCents: number; netCents: number; instructorShareCents: number; sales: number; enrolments: number; activeStudents: number }
export interface DashCourse { id: string; title: string; slug: string; status: string; updatedAt: string; thumbnailUrl: string | null; students: number; sales: number; grossCents: number; netCents: number; instructorShareCents: number; ratingAvg: number | null; ratingCount: number; completionRate: number | null }
export interface Dashboard {
  ownership: Ownership; official: boolean;
  range: { key: string; from: string; to: string; days: number };
  current: PeriodMoney; previous: PeriodMoney;
  series: { date: string; grossCents: number; netCents: number; sales: number }[];
  payouts: { pendingCents: number; paidCents: number } | null;
  catalogue: { published: number; drafts: number; ratingAvg: number | null; ratingCount: number; completionRate: number | null };
  students: { total: number; active: number; averageProgress: number | null; completionRate: number | null; quizAverage: number | null; quizAttempts: number; certificatesIssued: number; certificatesTotal: number };
  courses: DashCourse[];
  reviews: { id: string; rating: number; body: string; createdAt: string; replied: boolean; learner: string; course: { id: string; title: string } }[];
  activity: { kind: string; at: string; text: string; detail: string }[];
}

const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : Number(x) || 0);
const nn = (x: unknown) => (x === null || x === undefined ? null : n(x));
const s = (x: unknown) => (typeof x === "string" ? x : "");
const money = (x: unknown): PeriodMoney => {
  const o = obj(x);
  return { grossCents: n(o.grossCents), feesCents: n(o.feesCents), refundsCents: n(o.refundsCents), netCents: n(o.netCents), instructorShareCents: n(o.instructorShareCents), sales: n(o.sales), enrolments: n(o.enrolments), activeStudents: n(o.activeStudents) };
};

export function toDashboard(x: unknown): Dashboard {
  const o = obj(x), r = obj(o.range), cat = obj(o.catalogue), st = obj(o.students), p = o.payouts ? obj(o.payouts) : null;
  const own = s(o.ownership);
  return {
    ownership: own === "platform" || own === "del_agreement" ? own : "revenue_share",
    official: o.official === true,
    range: { key: s(r.key), from: s(r.from), to: s(r.to), days: n(r.days) },
    current: money(o.current), previous: money(o.previous),
    series: list(o.series).map((v) => { const d = obj(v); return { date: s(d.date), grossCents: n(d.grossCents), netCents: n(d.netCents), sales: n(d.sales) }; }),
    payouts: p ? { pendingCents: n(p.pendingCents), paidCents: n(p.paidCents) } : null,
    catalogue: { published: n(cat.published), drafts: n(cat.drafts), ratingAvg: nn(cat.ratingAvg), ratingCount: n(cat.ratingCount), completionRate: nn(cat.completionRate) },
    students: { total: n(st.total), active: n(st.active), averageProgress: nn(st.averageProgress), completionRate: nn(st.completionRate), quizAverage: nn(st.quizAverage), quizAttempts: n(st.quizAttempts), certificatesIssued: n(st.certificatesIssued), certificatesTotal: n(st.certificatesTotal) },
    courses: list(o.courses).map((v) => { const c = obj(v); return { id: s(c.id), title: s(c.title), slug: s(c.slug), status: s(c.status), updatedAt: s(c.updatedAt), thumbnailUrl: img(c.thumbnailUrl), students: n(c.students), sales: n(c.sales), grossCents: n(c.grossCents), netCents: n(c.netCents), instructorShareCents: n(c.instructorShareCents), ratingAvg: nn(c.ratingAvg), ratingCount: n(c.ratingCount), completionRate: nn(c.completionRate) }; }),
    reviews: list(o.reviews).map((v) => { const c = obj(v), co = obj(c.course); return { id: s(c.id), rating: n(c.rating), body: s(c.body), createdAt: s(c.createdAt), replied: c.replied === true, learner: s(c.learner), course: { id: s(co.id), title: s(co.title) } }; }),
    activity: list(o.activity).map((v) => { const a = obj(v); return { kind: s(a.kind), at: s(a.at), text: s(a.text), detail: s(a.detail) }; }),
  };
}
