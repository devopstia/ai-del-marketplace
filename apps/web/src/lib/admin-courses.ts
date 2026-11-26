import { obj, toStudioCourse } from "./normalize";

export type Lifecycle = "active" | "archived" | "deleting" | "purged";

/** An admin course row: the studio course plus archive / deletion facts (Super Admin › Courses, docs/SUPER_ADMIN.md). */
export const toAdminCourse = (x: unknown) => {
  const o = obj(x);
  return {
    ...toStudioCourse(x),
    lifecycle: String(o.lifecycle ?? "active") as Lifecycle,
    featured: !!o.featured,
    archivedAt: (o.archivedAt as string | null) ?? null,
    archiveReason: (o.archiveReason as string | null) ?? null,
    deleteRequestedAt: (o.deleteRequestedAt as string | null) ?? null,
    deleteAfter: (o.deleteAfter as string | null) ?? null,
    daysLeft: o.daysLeft == null ? null : Number(o.daysLeft),
    purgedAt: (o.purgedAt as string | null) ?? null,
    students: Number(o.students ?? 0),
  };
};
export type AdminCourse = ReturnType<typeof toAdminCourse>;

export interface CourseState {
  id: string; title: string; status: string; lifecycle: Lifecycle; featured: boolean; archivedAt: string | null; archiveReason: string | null;
  deleteRequestedAt: string | null; deleteAfter: string | null; daysLeft: number | null; purgedAt: string | null; retentionDays: number;
  learners: { paidAccessRunning: number; accessWithoutEndDate: number; lastPaidAccessEnds: string | null };
}
export const toCourseState = (x: unknown): CourseState => {
  const o = obj(x);
  const l = obj(o.learners);
  return {
    id: String(o.id), title: String(o.title ?? ""), status: String(o.status ?? "draft"), lifecycle: String(o.lifecycle ?? "active") as Lifecycle, featured: !!o.featured,
    archivedAt: (o.archivedAt as string | null) ?? null, archiveReason: (o.archiveReason as string | null) ?? null, deleteRequestedAt: (o.deleteRequestedAt as string | null) ?? null,
    deleteAfter: (o.deleteAfter as string | null) ?? null, daysLeft: o.daysLeft == null ? null : Number(o.daysLeft), purgedAt: (o.purgedAt as string | null) ?? null,
    retentionDays: Number(o.retentionDays ?? 30),
    learners: { paidAccessRunning: Number(l.paidAccessRunning ?? 0), accessWithoutEndDate: Number(l.accessWithoutEndDate ?? 0), lastPaidAccessEnds: (l.lastPaidAccessEnds as string | null) ?? null },
  };
};
