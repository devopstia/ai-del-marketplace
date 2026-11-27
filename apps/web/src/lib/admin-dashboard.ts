import { obj, list } from "./normalize";

/** GET /admin/dashboard (apps/api/src/admin/admin-dashboard.service.ts), mapped defensively. Null blocks = no permission. */
export interface MarketMoney { grossCents: number; feesCents: number; refundsCents: number; instructorEarningsCents: number; platformNetCents: number; delCoursesNetCents: number; commissionCents: number; sales: number; failedPayments: number }
export interface Ranked { id: string; label: string; grossCents: number; platformNetCents: number; sales: number; kind?: string }
export interface Trend { current: number; previous: number }
export interface AdminDashboard {
  range: { key: string; days: number };
  finance: null | {
    current: MarketMoney; previous: MarketMoney;
    series: { date: string; grossCents: number; netCents: number }[];
    payouts: { pendingCents: number; pendingCount: number; paidCents: number; paidCount: number };
    byCourse: Ranked[]; byInstructor: Ranked[];
    webhooks: { received: number; lastAt: string | null; stripeOrders: number };
  };
  platform: null | { users: number; newUsers: Trend; activeStudents: Trend; instructors: { del: number; official: number; independent: number }; enrolments: Trend & { total: number }; completions: Trend & { total: number } };
  catalogue: null | { published: number; drafts: number; pendingApproval: number };
  attention: { key: string; label: string; count: number; href: string }[];
  health: null | { checkedAt: string; checks: { name: string; ok: boolean; detail: string }[]; queues: { name: string; ok: boolean; failed: number; waiting: number }[]; failedVideos: number };
  audit: null | { id: string; action: string; targetType: string; at: string; status: string; actor: string }[];
}

const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : Number(x) || 0);
const s = (x: unknown) => (typeof x === "string" ? x : "");
const trend = (x: unknown): Trend => { const o = obj(x); return { current: n(o.current), previous: n(o.previous) }; };
const mm = (x: unknown): MarketMoney => {
  const o = obj(x);
  return { grossCents: n(o.grossCents), feesCents: n(o.feesCents), refundsCents: n(o.refundsCents), instructorEarningsCents: n(o.instructorEarningsCents), platformNetCents: n(o.platformNetCents), delCoursesNetCents: n(o.delCoursesNetCents), commissionCents: n(o.commissionCents), sales: n(o.sales), failedPayments: n(o.failedPayments) };
};

export function toAdminDashboard(x: unknown): AdminDashboard {
  const o = obj(x), r = obj(o.range);
  const f = o.finance ? obj(o.finance) : null, p = o.platform ? obj(o.platform) : null, c = o.catalogue ? obj(o.catalogue) : null, h = o.health ? obj(o.health) : null;
  return {
    range: { key: s(r.key), days: n(r.days) },
    finance: f ? {
      current: mm(f.current), previous: mm(f.previous),
      series: list(f.series).map((v) => { const d = obj(v); return { date: s(d.date), grossCents: n(d.grossCents), netCents: n(d.netCents) }; }),
      payouts: (() => { const po = obj(f.payouts); return { pendingCents: n(po.pendingCents), pendingCount: n(po.pendingCount), paidCents: n(po.paidCents), paidCount: n(po.paidCount) }; })(),
      byCourse: list(f.byCourse).map((v) => { const d = obj(v); return { id: s(d.id), label: s(d.title), grossCents: n(d.grossCents), platformNetCents: n(d.platformNetCents), sales: n(d.sales) }; }),
      byInstructor: list(f.byInstructor).map((v) => { const d = obj(v); return { id: s(d.id), label: s(d.name), grossCents: n(d.grossCents), platformNetCents: n(d.platformNetCents), sales: n(d.sales), kind: s(d.kind) }; }),
      webhooks: { received: n(obj(f.webhooks).received), lastAt: s(obj(f.webhooks).lastAt) || null, stripeOrders: n(obj(f.webhooks).stripeOrders) },
    } : null,
    platform: p ? {
      users: n(p.users), newUsers: trend(p.newUsers), activeStudents: trend(p.activeStudents),
      instructors: { del: n(obj(p.instructors).del), official: n(obj(p.instructors).official), independent: n(obj(p.instructors).independent) },
      enrolments: { ...trend(p.enrolments), total: n(obj(p.enrolments).total) },
      completions: { ...trend(p.completions), total: n(obj(p.completions).total) },
    } : null,
    catalogue: c ? { published: n(c.published), drafts: n(c.drafts), pendingApproval: n(c.pendingApproval) } : null,
    attention: list(o.attention).map((v) => { const a = obj(v); return { key: s(a.key), label: s(a.label), count: n(a.count), href: s(a.href) }; }),
    health: h ? {
      checkedAt: s(h.checkedAt),
      checks: list(h.checks).map((v) => { const k = obj(v); return { name: s(k.name), ok: k.ok === true, detail: s(k.detail) }; }),
      queues: list(h.queues).map((v) => { const q = obj(v); return { name: s(q.name), ok: q.ok === true, failed: n(q.failed), waiting: n(q.waiting) }; }),
      failedVideos: n(h.failedVideos),
    } : null,
    audit: o.audit ? list(o.audit).map((v) => { const a = obj(v); return { id: s(a.id), action: s(a.action), targetType: s(a.targetType), at: s(a.at), status: s(a.status), actor: s(a.actor) || "System" }; }) : null,
  };
}
