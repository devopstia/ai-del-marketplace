import "server-only";
import { serverGet } from "./server-api";
import { list, paged, toCategory, toCourseCard, toCourseDetail, toInstructor, toReviewSummary, obj } from "./normalize";
import type { Category, CourseCard, CourseDetail, InstructorSummary, Paged, ReviewSummary } from "./types";
import { qs } from "./qs";

export async function getCategories(): Promise<Category[]> {
  const r = await serverGet("/categories");
  return r.ok ? list(r.data, "categories").map(toCategory) : [];
}

export async function getCourses(query: Record<string, string | number | undefined>): Promise<Paged<CourseCard> & { ok: boolean }> {
  const r = await serverGet(`/courses${qs(query)}`);
  if (!r.ok) return { ok: false, items: [], total: 0, page: 1, pageSize: 12 };
  return { ok: true, ...paged(r.data, toCourseCard, "courses") };
}

export async function getCourse(slug: string): Promise<CourseDetail | null> {
  const r = await serverGet(`/courses/${encodeURIComponent(slug)}`);
  return r.ok ? toCourseDetail(r.data) : null;
}

export async function getReviews(slug: string, fallback: { ratingAvg: number; ratingCount: number }): Promise<ReviewSummary> {
  const r = await serverGet(`/courses/${encodeURIComponent(slug)}/reviews`);
  return toReviewSummary(r.ok ? r.data : [], fallback);
}

export async function getInstructor(id: string): Promise<{ instructor: InstructorSummary; courses: CourseCard[] } | null> {
  const r = await serverGet(`/instructors/${encodeURIComponent(id)}`);
  if (!r.ok) return null;
  const o = obj(r.data);
  const base = obj(o.instructor ?? o);
  return { instructor: toInstructor(base), courses: list(o.courses ?? base.courses).map(toCourseCard) };
}

/** Approved instructors with published courses and correct per-instructor counts (never derive these from course lists). */
export async function getFeaturedInstructors(limit = 3): Promise<InstructorSummary[]> {
  const r = await serverGet(`/instructors/featured${qs({ limit })}`);
  return r.ok ? list(r.data).map(toInstructor) : [];
}

/** Public marketplace terms (revenue share, price range). Null when the API is unreachable. */
export async function getTerms(): Promise<{ instructorSharePercent: number; minCents: number; maxCents: number } | null> {
  const r = await serverGet("/platform/terms");
  if (!r.ok) return null;
  const o = obj(r.data);
  const p = obj(o.pricing);
  return { instructorSharePercent: Number(o.instructorSharePercent ?? 80), minCents: Number(p.minCents ?? 499), maxCents: Number(p.maxCents ?? 99999) };
}
