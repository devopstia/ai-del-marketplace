// Tolerant converters from raw API JSON to the app's types.
// The API contract lives in docs/BUILD_SPEC.md and docs/API.md; these keep the UI stable if a field is
// nested slightly differently (e.g. `instructor.name` vs `instructorName`).
import type { SaleInfo, SaleRow, StudioRevision,
  AdminInstructor, AdminStats, AdminUser, AuditEntry, Cart, Category, Certificate, CourseCard, CourseDetail,
  InstructorSummary, LearningItem, LectureOutline, Level, Me, Order, Paged, Review, ReviewSummary, Role,
  SalesReport, SectionOutline, StudioCourse, StudioLecture, StudioSection, StudentRow,
} from "./types";

type R = Record<string, unknown>;
export const obj = (x: unknown): R => (x && typeof x === "object" ? (x as R) : {});
const str = (x: unknown, d = ""): string => (typeof x === "string" ? x : typeof x === "number" ? String(x) : d);
const num = (x: unknown, d = 0): number => {
  const n = typeof x === "string" ? Number(x) : (x as number);
  return typeof n === "number" && Number.isFinite(n) ? n : d;
};
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
/** API image URLs are rewritten to the web app's same-origin image proxy (/media/images/...). */
export const img = (x: unknown): string | null => {
  const u = typeof x === "string" ? x : "";
  if (!u) return null;
  const i = u.indexOf("/media/images/");
  return i >= 0 ? u.slice(i) : u;
};
export const strs = (x: unknown): string[] => arr(x).map((v) => str(v)).filter(Boolean);

/** Pull the list out of `[...]`, `{items}`, `{data}` or `{<key>}`. */
export function list(x: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(x)) return x;
  const o = obj(x);
  for (const k of [...keys, "items", "data", "results", "rows"]) if (Array.isArray(o[k])) return o[k] as unknown[];
  return [];
}

export function paged<T>(x: unknown, map: (v: unknown) => T, ...keys: string[]): Paged<T> {
  const o = obj(x);
  const items = list(x, ...keys).map(map);
  const meta = obj(o.meta ?? o.pagination);
  const pageSize = num(o.pageSize ?? o.limit ?? meta.pageSize ?? meta.limit, items.length || 12);
  return {
    items,
    total: num(o.total ?? o.count ?? meta.total, items.length),
    page: num(o.page ?? meta.page, 1),
    pageSize: pageSize || 12,
  };
}

const levels: Level[] = ["beginner", "intermediate", "advanced"];
const toLevel = (x: unknown): Level => (levels.includes(str(x).toLowerCase() as Level) ? (str(x).toLowerCase() as Level) : "beginner");

export function toMe(x: unknown): Me | null {
  const o = obj(x);
  const u = obj(o.user ?? o);
  if (!u.id && !u.email) return null;
  const ip = obj(u.instructor ?? u.instructorProfile ?? o.instructorProfile);
  return {
    id: str(u.id),
    email: str(u.email),
    name: str(u.name, str(u.email).split("@")[0]),
    avatarUrl: img(u.avatarUrl),
    roles: (strs(u.roles ?? o.roles).length ? strs(u.roles ?? o.roles) : ["student"]) as Role[],
    status: str(u.status, "active"),
    instructorStatus: (str(u.instructorStatus ?? ip.status ?? o.instructorStatus) || null) as Me["instructorStatus"],
    createdAt: str(u.createdAt) || undefined,
    actingAs: obj(u.actingAs).id ? { id: str(obj(u.actingAs).id), name: str(obj(u.actingAs).name) } : null,
    adminPermissions: strs(u.adminPermissions),
    emailVerified: !!u.emailVerifiedAt,
    mfaEnabled: u.mfaEnabled === true,
    signupMethod: str(u.signupMethod) || undefined,
  };
}

export function toCategory(x: unknown): Category {
  const o = obj(x);
  const c = obj(o._count);
  return {
    id: str(o.id),
    slug: str(o.slug),
    name: str(o.name),
    icon: (o.icon as string) ?? null,
    courseCount: o.courseCount != null || c.courses != null ? num(o.courseCount ?? c.courses) : undefined,
  };
}

function instructorRef(o: R): { id: string; name: string } {
  const i = obj(o.instructor);
  return { id: str(i.id ?? i.userId ?? o.instructorId), name: str(i.name ?? o.instructorName, "DevOps Easy Learning") };
}

export function toSale(x: unknown): SaleInfo | null {
  const s = obj(x);
  if (!s.id || !s.endsAt) return null;
  return { kind: s.kind === "promotion" ? "promotion" : "course_sale", id: str(s.id), name: s.name ? str(s.name) : null, endsAt: str(s.endsAt), percentOff: num(s.percentOff) };
}

export function toCourseCard(x: unknown): CourseCard {
  const o = obj(x);
  const cat = obj(o.category);
  return {
    id: str(o.id),
    slug: str(o.slug),
    title: str(o.title, "Untitled course"),
    subtitle: str(o.subtitle),
    thumbnailUrl: img(o.thumbnailUrl),
    instructor: instructorRef(o),
    priceCents: num(o.priceCents),
    currency: str(o.currency, "usd"),
    ratingAvg: num(o.ratingAvg),
    ratingCount: num(o.ratingCount),
    studentCount: num(o.studentCount),
    totalDurationSec: num(o.totalDurationSec ?? o.durationSec),
    lectureCount: o.lectureCount != null ? num(o.lectureCount) : undefined,
    level: toLevel(o.level),
    category: cat.slug ? { slug: str(cat.slug), name: str(cat.name) } : o.categorySlug ? { slug: str(o.categorySlug), name: str(o.categoryName) } : null,
    publishedAt: (o.publishedAt as string) ?? null,
    updatedAt: (o.updatedAt as string) ?? null,
    hasPreview: o.hasPreview === true,
    outcome: typeof o.outcome === "string" && o.outcome.trim() ? o.outcome.trim() : null,
    listPriceCents: o.listPriceCents != null ? num(o.listPriceCents) : num(o.priceCents),
    sale: toSale(o.sale),
  };
}

export function toInstructor(x: unknown): InstructorSummary {
  const o = obj(x);
  const p = obj(o.instructorProfile ?? o.profile);
  const st = obj(o.stats);
  if (o.courseCount == null && st.courses != null) o.courseCount = st.courses;
  if (o.studentCount == null && st.students != null) o.studentCount = st.students;
  if (o.ratingCount == null && st.reviews != null) o.ratingCount = st.reviews;
  if (o.ratingAvg == null && st.rating != null) o.ratingAvg = st.rating;
  return {
    id: str(o.id ?? o.userId),
    name: str(o.name, "Instructor"),
    headline: (str(o.headline ?? p.headline) || null),
    bio: (str(o.bio ?? p.bio) || null),
    avatarUrl: img(o.avatarUrl),
    website: (str(o.website ?? p.website) || null),
    courseCount: o.courseCount != null ? num(o.courseCount) : undefined,
    studentCount: o.studentCount != null ? num(o.studentCount) : undefined,
    ratingAvg: o.ratingAvg != null ? num(o.ratingAvg) : undefined,
    ratingCount: o.ratingCount != null ? num(o.ratingCount) : undefined,
  };
}

export function toLecture(x: unknown): LectureOutline {
  const o = obj(x);
  const p = obj(o.progress);
  return {
    id: str(o.id),
    title: str(o.title),
    type: (str(o.type, "video") as LectureOutline["type"]),
    durationSec: num(o.durationSec),
    isPreview: Boolean(o.isPreview),
    position: o.position != null ? num(o.position) : undefined,
    completed: Boolean(o.completed ?? p.completed),
    positionSec: num(o.positionSec ?? p.positionSec),
    hasResources: Boolean(o.hasResources ?? (num(o.resourceCount) > 0 || arr(o.resources).length > 0)),
    hasQuiz: Boolean(o.hasQuiz ?? o.quiz ?? str(o.type) === "quiz"),
    articleMd: (o.articleMd as string) ?? null,
    // the API sends the lecture's short description as `summary`
    description: ((o.description ?? o.summary) as string) || null,
  };
}

export function toSection(x: unknown): SectionOutline {
  const o = obj(x);
  return { id: str(o.id), title: str(o.title), position: num(o.position), lectures: arr(o.lectures).map(toLecture) };
}

export function toCourseDetail(x: unknown): CourseDetail {
  const raw = obj(x);
  const o = obj(raw.course ?? raw);
  const card = toCourseCard(o);
  const sections = arr(o.sections ?? o.curriculum).map(toSection);
  const totalDur = card.totalDurationSec || sections.reduce((a, s) => a + s.lectures.reduce((b, l) => b + l.durationSec, 0), 0);
  return {
    ...card,
    totalDurationSec: totalDur,
    lectureCount: card.lectureCount ?? sections.reduce((a, s) => a + s.lectures.length, 0),
    description: str(o.description),
    language: str(o.language, "en"),
    objectives: strs(o.objectives),
    requirements: strs(o.requirements),
    instructor: { ...toInstructor(o.instructor), id: card.instructor.id || toInstructor(o.instructor).id },
    sections,
    enrolled: Boolean(raw.enrolled ?? o.enrolled ?? obj(raw.viewer).enrolled),
    inCart: Boolean(raw.inCart ?? o.inCart ?? obj(raw.viewer).inCart),
    isOwner: Boolean(raw.isOwner ?? o.isOwner ?? obj(raw.viewer).isOwner),
    hasPromo: Boolean(o.hasPromo ?? o.promoVideoAssetId),
    resourceCount: num(raw.resourceCount ?? o.resourceCount ?? obj(raw.totals).resources),
    viewerSignedIn: Boolean(obj(raw.viewer).signedIn),
    access: (() => {
      const a = obj(obj(raw.viewer).access);
      if (!a.state) return null;
      return { state: a.state as "active" | "expiring" | "expired", expiresAt: (a.expiresAt as string) ?? null, daysLeft: a.daysLeft == null ? null : Number(a.daysLeft), canRenew: a.canRenew === true };
    })(),
    hasCaptions: Boolean(raw.hasCaptions ?? o.hasCaptions),
  };
}

export function toReview(x: unknown): Review {
  const o = obj(x);
  const u = obj(o.author ?? o.user);
  const c = obj(o.course);
  return {
    id: str(o.id),
    rating: num(o.rating),
    body: str(o.body),
    createdAt: str(o.createdAt),
    user: { name: str(u.name ?? o.userName, "Student"), avatarUrl: img(u.avatarUrl) },
    instructorReply: (str(o.instructorReply) || null),
    course: c.slug || c.title ? { slug: str(c.slug), title: str(c.title) } : null,
    status: str(o.status) || undefined,
  };
}

export function toReviewSummary(x: unknown, fallback?: { ratingAvg: number; ratingCount: number }): ReviewSummary {
  const o = obj(x);
  const items = list(x, "reviews").map(toReview);
  const b = obj(o.breakdown ?? o.distribution);
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as ReviewSummary["breakdown"];
  const hasB = Object.keys(b).length > 0;
  for (const k of [1, 2, 3, 4, 5] as const) breakdown[k] = hasB ? num(b[k] ?? b[String(k)]) : items.filter((r) => Math.round(r.rating) === k).length;
  const count = num(o.ratingCount ?? o.total, fallback?.ratingCount ?? items.length);
  const avg = num(o.ratingAvg, fallback?.ratingAvg ?? (items.length ? items.reduce((a, r) => a + r.rating, 0) / items.length : 0));
  return { items, ratingAvg: avg, ratingCount: count, breakdown };
}

export function toCart(x: unknown): Cart {
  const o = obj(x);
  const items = list(x, "items").map((v) => {
    const i = obj(v);
    const course = toCourseCard(i.course ?? i);
    return { courseId: str(i.courseId ?? course.id), course };
  });
  return {
    items,
    totalCents: num(o.totalCents, items.reduce((a, i) => a + i.course.priceCents, 0)),
    currency: str(o.currency, "usd"),
  };
}

export function toOrder(x: unknown): Order {
  const raw = obj(x);
  const o = obj(raw.order ?? raw);
  const u = obj(o.user);
  return {
    id: str(o.id),
    status: str(o.status, "pending") as Order["status"],
    totalCents: num(o.totalCents),
    currency: str(o.currency, "usd"),
    createdAt: str(o.createdAt),
    paidAt: (o.paidAt as string) ?? null,
    // Admin order lists send `courses: [{ id, title, slug, refunded }]` and `lines` as a count.
    lines: (Array.isArray(o.lines) || !Array.isArray(o.courses) ? arr(o.lines ?? o.orderLines ?? o.items) : arr(o.courses).map((c) => ({ course: c, refundedAt: obj(c).refunded ? "refunded" : null }))).map((l) => {
      const lo = obj(l);
      const c = obj(lo.course);
      const ins = obj(lo.instructor ?? c.instructor);
      return {
        id: str(lo.id),
        courseId: str(lo.courseId ?? c.id),
        title: str(lo.title ?? c.title, "Course"),
        slug: str(lo.slug ?? c.slug) || undefined,
        priceCents: num(lo.priceCents),
        listPriceCents: lo.listPriceCents != null ? num(lo.listPriceCents) : undefined,
        instructorName: str(ins.name ?? lo.instructorName) || undefined,
        refundedAt: (lo.refundedAt as string) ?? null,
      };
    }),
    user: u.id ? { id: str(u.id), name: str(u.name), email: str(u.email) } : null,
    lineCount: typeof o.lines === "number" ? o.lines : arr(o.lines ?? o.orderLines ?? o.items).length,
    terms: obj(o.terms).version ? { version: str(obj(o.terms).version), acceptedAt: str(obj(o.terms).acceptedAt) || null } : null,
  };
}

export function toLearningItem(x: unknown): LearningItem {
  const o = obj(x);
  const last = obj(o.lastLecture);
  const prog = obj(o.progress);
  return {
    course: toCourseCard(o.course ?? o),
    progressPct: Math.max(0, Math.min(100, Math.round(num(o.progressPct ?? prog.percent ?? o.progress ?? o.percent)))),
    completedLectures: (o.completedLectures ?? prog.completed) != null ? num(o.completedLectures ?? prog.completed) : undefined,
    totalLectures: (o.totalLectures ?? prog.total) != null ? num(o.totalLectures ?? prog.total) : undefined,
    lastLectureId: (str(o.lastLectureId ?? last.id) || null),
    lastLectureTitle: (str(o.lastLectureTitle ?? last.title) || null),
    lastActivityAt: (str(o.lastActivityAt ?? last.at ?? o.enrolledAt ?? o.updatedAt) || null),
    certificateCode: (str(o.certificateCode ?? obj(o.certificate).code) || null),
    access: (() => {
      const a = obj(o.access);
      if (!a.state) return null;
      return { state: a.state as "active" | "expiring" | "expired", purchasedAt: (a.purchasedAt as string) ?? null, expiresAt: (a.expiresAt as string) ?? null, daysLeft: a.daysLeft == null ? null : Number(a.daysLeft), canRenew: a.canRenew === true };
    })(),
  };
}

export function toCertificate(x: unknown): Certificate {
  const raw = obj(x);
  const o = obj(raw.certificate ?? raw);
  const u = obj(o.user ?? raw.user);
  const c = obj(o.course ?? raw.course);
  return {
    code: str(o.code),
    issuedAt: str(o.issuedAt),
    user: { name: str(u.name ?? o.studentName ?? o.userName, "Student") },
    course: {
      title: str(c.title ?? o.courseTitle),
      slug: str(c.slug ?? o.courseSlug),
      instructorName: str(obj(c.instructor).name ?? c.instructorName) || undefined,
      totalDurationSec: c.totalDurationSec != null ? num(c.totalDurationSec) : undefined,
    },
  };
}

function toStudioLecture(x: unknown): StudioLecture {
  const o = obj(x);
  const v = obj(o.videoAsset ?? o.video);
  const q = obj(o.quiz);
  return {
    id: str(o.id),
    title: str(o.title),
    type: str(o.type, "video") as StudioLecture["type"],
    position: num(o.position),
    durationSec: num(o.durationSec ?? v.durationSec),
    isPreview: Boolean(o.isPreview),
    videoAssetId: (str(o.videoAssetId ?? v.id) || null),
    videoStatus: (str(o.videoStatus ?? v.status) || null) as StudioLecture["videoStatus"],
    articleMd: (o.articleMd as string) ?? null,
    resources: arr(o.resources).map((r) => {
      const ro = obj(r);
      return { id: str(ro.id), title: str(ro.title), sizeBytes: num(ro.sizeBytes), mime: str(ro.mime) };
    }),
    quiz: q.questions ? { questions: arr(q.questions).map((qq) => {
      const qo = obj(qq);
      return { q: str(qo.q), options: strs(qo.options), correct: num(qo.correct), why: str(qo.why) };
    }) } : null,
  };
}

export function toStudioCourse(x: unknown): StudioCourse {
  const raw = obj(x);
  const o = obj(raw.course ?? raw);
  const cat = obj(o.category);
  const sections: StudioSection[] = arr(o.sections).map((s) => {
    const so = obj(s);
    return { id: str(so.id), title: str(so.title), position: num(so.position), lectures: arr(so.lectures).map(toStudioLecture).sort((a, b) => a.position - b.position) };
  }).sort((a, b) => a.position - b.position);
  return {
    id: str(o.id),
    slug: str(o.slug),
    title: str(o.title),
    subtitle: str(o.subtitle),
    description: str(o.description),
    language: str(o.language, "en"),
    level: toLevel(o.level),
    categoryId: (str(o.categoryId ?? cat.id) || null),
    category: cat.slug ? { slug: str(cat.slug), name: str(cat.name) } : null,
    objectives: strs(o.objectives),
    requirements: strs(o.requirements),
    priceCents: num(o.priceCents),
    currency: str(o.currency, "usd"),
    thumbnailUrl: img(o.thumbnailUrl),
    thumbnailKey: (o.thumbnailKey as string) ?? null,
    promoVideoAssetId: (o.promoVideoAssetId as string) ?? null,
    status: str(o.status, "draft") as StudioCourse["status"],
    reviewNote: (o.reviewNote as string) ?? null,
    sections,
    studentCount: num(o.studentCount ?? o.students),
    ratingAvg: num(o.ratingAvg),
    ratingCount: num(o.ratingCount),
    lectureCount: o.lectureCount != null ? num(o.lectureCount) : sections.reduce((a, s) => a + s.lectures.length, 0),
    updatedAt: str(o.submittedAt ?? o.updatedAt) || undefined,
    instructor: obj(o.instructor).name ? instructorRef(o) : null,
    version: o.version === "draft" ? "draft" : o.version === "live" ? "live" : undefined,
    revision: toStudioRevision(o.revision),
    promoVideo: o.promoVideo ? { id: str(obj(o.promoVideo).id), status: str(obj(o.promoVideo).status, "processing") as "processing" } : null,
  };
}

export function toStudioRevision(x: unknown): StudioRevision | null {
  if (!x) return null;
  const r = obj(x);
  if (!r.id) return null;
  return {
    id: str(r.id),
    status: str(r.status, "draft") as StudioRevision["status"],
    reviewNote: (str(r.reviewNote) || null),
    submittedAt: (str(r.submittedAt) || null),
    changes: arr(r.changes).map((c) => { const co = obj(c); return { area: str(co.area), kind: str(co.kind), message: str(co.message) }; }).filter((c) => c.message),
  };
}

export function toSales(x: unknown): SalesReport {
  const o = obj(x);
  const rows = list(x, "lines", "sales", "rows").map((r) => {
    const ro = obj(r);
    if (!ro.id && ro.orderLineId) ro.id = ro.orderLineId;
    const c = obj(ro.course);
    const ord = obj(ro.order);
    const buyer = obj(ro.buyer ?? ord.user ?? ro.user);
    return {
      id: str(ro.id),
      at: str(ro.at ?? ro.paidAt ?? ord.paidAt ?? ro.createdAt),
      courseTitle: str(ro.courseTitle ?? c.title, "Course"),
      buyerName: str(buyer.name ?? ro.buyerName) || undefined,
      priceCents: num(ro.priceCents),
      listPriceCents: ro.listPriceCents != null ? num(ro.listPriceCents) : undefined,
      instructorShareCents: num(ro.instructorShareCents ?? ro.priceCents),
      transferStatus: str(ro.transferStatus) || undefined,
      feeCents: num(ro.feeCents),
      netCents: num(ro.netCents ?? ro.priceCents),
      payee: (str(ro.payee, "instructor") as SaleRow["payee"]),
      transferDueAt: str(ro.transferDueAt) || null,
      refundedAt: str(ro.refundedAt) || null,
      disputeStatus: str(ro.disputeStatus) || null,
    };
  });
  const totals = obj(o.totals ?? o.summary);
  return {
    totalCents: num(o.totalCents ?? totals.grossCents ?? totals.totalCents, rows.reduce((a, r) => a + r.priceCents, 0)),
    instructorShareCents: num(o.instructorShareCents ?? totals.earningsCents ?? totals.instructorShareCents ?? totals.netCents, rows.reduce((a, r) => a + r.instructorShareCents, 0)),
    count: num(o.count ?? totals.sales ?? totals.count, rows.length),
    feesCents: num(totals.feesCents),
    heldCents: num(totals.heldCents),
    rows,
    series: arr(o.series ?? o.daily).map((s) => ({ date: str(obj(s).date), cents: num(obj(s).cents ?? obj(s).totalCents) })),
  };
}

export function toStudent(x: unknown): StudentRow {
  const o = obj(x);
  const u = obj(o.student ?? o.user);
  const c = obj(o.course);
  if (o.progressPct == null && o.progressPercent != null) o.progressPct = o.progressPercent;
  return {
    id: str(o.id ?? u.id) + str(c.id ?? o.courseId),
    name: str(u.name ?? o.name, "Student"),
    email: str(u.email ?? o.email) || undefined,
    courseTitle: str(c.title ?? o.courseTitle),
    enrolledAt: str(o.enrolledAt ?? o.createdAt),
    progressPct: o.progressPct != null ? num(o.progressPct) : undefined,
  };
}

export function toAdminStats(x: unknown): AdminStats {
  const o = obj(obj(x).stats ?? x);
  return {
    users: num(o.users ?? o.userCount),
    instructors: num(o.instructors ?? o.instructorCount),
    courses: num(o.courses ?? o.courseCount ?? o.publishedCourses),
    publishedCourses: num(o.publishedCourses ?? o.published),
    pendingReviews: num(o.pendingReviews ?? o.coursesInReview ?? o.reviewQueue ?? o.inReview),
    pendingInstructors: num(o.pendingInstructors),
    revenueCents: num(o.revenueCents ?? o.grossRevenueCents ?? o.grossCents),
    orders: num(o.orders ?? o.paidOrders),
    platformRevenueCents: num(o.platformRevenueCents),
    refundedCents: num(o.refundedCents),
    enrollments: num(o.enrollments),
  };
}

export function toAdminUser(x: unknown): AdminUser {
  const o = obj(x);
  return {
    id: str(o.id), name: str(o.name), email: str(o.email),
    roles: strs(o.roles) as Role[], status: str(o.status, "active") as AdminUser["status"], createdAt: str(o.createdAt),
  };
}

export function toAdminInstructor(x: unknown): AdminInstructor {
  const o = obj(x);
  const u = obj(o.user);
  return {
    userId: str(o.userId ?? u.id ?? o.id),
    name: str(u.name ?? o.name),
    email: str(u.email ?? o.email),
    headline: (str(o.headline) || null),
    status: str(o.status, "pending") as AdminInstructor["status"],
    payoutsEnabled: Boolean(o.payoutsEnabled),
    courseCount: (o.courseCount ?? o.courses) != null ? num(o.courseCount ?? o.courses) : undefined,
    createdAt: str(o.appliedAt ?? o.createdAt ?? u.createdAt) || undefined,
    isPlatform: Boolean(o.isPlatform),
    commissionBps: o.commissionBps == null ? null : num(o.commissionBps),
    payToPlatform: Boolean(o.payToPlatform),
  };
}

export function toAudit(x: unknown): AuditEntry {
  const o = obj(x);
  const a = obj(o.actor);
  return {
    id: str(o.id), action: str(o.action), targetType: str(o.targetType), targetId: str(o.targetId),
    ip: (o.ip as string) ?? null, meta: o.meta, at: str(o.at ?? o.createdAt),
    actor: a.id || o.actorId ? { id: str(a.id ?? o.actorId), name: str(a.name ?? a.email ?? o.actorId), email: str(a.email) || undefined } : null,
  };
}
