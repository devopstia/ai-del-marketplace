import type { Prisma } from '../generated/prisma/client';
import type { AuditService } from '../common/audit.service';
import type { PrismaService } from '../common/prisma.service';
import type { StorageService } from '../common/storage.service';

/**
 * Course archive and soft deletion (owner 2026-11-26; docs/SUPER_ADMIN.md):
 * - archived: off the marketplace (not listed, not for sale), kept for later, never deleted automatically;
 * - deleting: archived + deletion requested; content is removed after `deleteAfter` (at least 30 days), and only once no
 *   paid year of access is still running (a paid year is never cut short); restorable until then;
 * - purged: videos, files and lessons removed; the course row stays so receipts, refunds and certificates still read.
 * Orders, order lines, refunds, enrolments, certificates, reviews and the audit log are never deleted.
 */
export const DELETION_RETENTION_DAYS = 30;
const DAY = 86_400_000;

export type Lifecycle = 'active' | 'archived' | 'deleting' | 'purged';
export interface LifecycleFields { archivedAt: Date | null; deleteRequestedAt: Date | null; deleteAfter: Date | null; purgedAt: Date | null }

export function lifecycle(c: LifecycleFields): Lifecycle {
  if (c.purgedAt) return 'purged';
  if (c.deleteRequestedAt) return 'deleting';
  if (c.archivedAt) return 'archived';
  return 'active';
}

/** Whole days until the permanent deletion date (0 once it has passed); null when no deletion is scheduled. */
export function daysUntilDeletion(c: Pick<LifecycleFields, 'deleteAfter'>, now = new Date()): number | null {
  if (!c.deleteAfter) return null;
  return Math.max(0, Math.ceil((c.deleteAfter.getTime() - now.getTime()) / DAY));
}

export const deletionDate = (from: Date, days = DELETION_RETENTION_DAYS) => new Date(from.getTime() + days * DAY);

/**
 * Learners whose paid year is still running (not revoked, expiry in the future): a deletion waits for the last one.
 * Access without an end date (free courses, grants) doesn't hold a deletion back; those learners are told in advance.
 */
export const activeAccessWhere = (courseId: string, now = new Date()): Prisma.EnrollmentWhereInput => ({
  courseId, revokedAt: null, accessExpiresAt: { gt: now },
});

/** Video assets among `ids` that another course (lesson or promo video) or a help video still uses. */
export async function sharedAssetIds(prisma: PrismaService, courseId: string, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const [lectures, promos, help] = await Promise.all([
    prisma.lecture.findMany({ where: { videoAssetId: { in: ids }, section: { courseId: { not: courseId } } }, select: { videoAssetId: true } }),
    prisma.course.findMany({ where: { id: { not: courseId }, promoVideoAssetId: { in: ids } }, select: { promoVideoAssetId: true } }),
    prisma.helpVideo.findMany({ where: { videoAssetId: { in: ids } }, select: { videoAssetId: true } }),
  ]);
  return new Set([...lectures.map((l) => l.videoAssetId), ...promos.map((p) => p.promoVideoAssetId), ...help.map((h) => h.videoAssetId)].filter((x): x is string => !!x));
}

/** Storage keys among `keys` that another course's lesson files or course package still use. */
export async function sharedResourceKeys(prisma: PrismaService, courseId: string, keys: string[]): Promise<Set<string>> {
  if (!keys.length) return new Set();
  const [res, pkg] = await Promise.all([
    prisma.resource.findMany({ where: { storageKey: { in: keys }, lecture: { section: { courseId: { not: courseId } } } }, select: { storageKey: true } }),
    prisma.courseResource.findMany({ where: { storageKey: { in: keys }, courseId: { not: courseId } }, select: { storageKey: true } }),
  ]);
  return new Set([...res.map((r) => r.storageKey), ...pkg.map((p) => p.storageKey)]);
}

/** Where the scheduled purge looks: deletion date passed, not purged yet. */
export const dueForPurgeWhere = (now = new Date()): Prisma.CourseWhereInput => ({ deleteRequestedAt: { not: null }, deleteAfter: { lte: now }, purgedAt: null });

/**
 * Hourly (payments queue): removes the content of courses whose deletion date passed and that nobody can still open.
 * Storage first (best effort, logged), then the rows. Returns what it did, for the log.
 */
export async function purgeDueCourses(prisma: PrismaService, storage: StorageService, audit: AuditService, now = new Date()) {
  const due = await prisma.course.findMany({ where: dueForPurgeWhere(now), select: { id: true, title: true, promoVideoAssetId: true } });
  let purged = 0;
  let waiting = 0;
  for (const c of due) {
    if (await prisma.enrollment.count({ where: activeAccessWhere(c.id, now) })) { waiting++; continue; }
    const lectures = await prisma.lecture.findMany({ where: { section: { courseId: c.id } }, select: { videoAssetId: true, resources: { select: { storageKey: true } } } });
    const ownAssetIds = [...new Set([...lectures.map((l) => l.videoAssetId), c.promoVideoAssetId].filter((x): x is string => !!x))];
    // Shared media (owner 2026-11-27): the same video or file may serve several courses of one account. Anything still
    // used by another course (lesson, promo video, lesson file or course package) or by a help video is kept.
    const sharedAssets = await sharedAssetIds(prisma, c.id, ownAssetIds);
    const assetIds = ownAssetIds.filter((id) => !sharedAssets.has(id));
    const assets = await prisma.videoAsset.findMany({ where: { id: { in: assetIds } }, select: { id: true, storageKey: true, captionsKey: true, hlsKey: true, hlsPrefix: true } });
    const pkg = await prisma.courseResource.findMany({ where: { courseId: c.id }, select: { storageKey: true } });
    const fileKeys = [...new Set([...lectures.flatMap((l) => l.resources.map((r) => r.storageKey)), ...pkg.map((p) => p.storageKey)])];
    const sharedKeys = await sharedResourceKeys(prisma, c.id, fileKeys);
    const keys = [...assets.flatMap((a) => [a.storageKey, a.captionsKey, a.hlsKey]), ...fileKeys.filter((k) => !sharedKeys.has(k))].filter((k): k is string => !!k);
    let storageErrors = 0;
    for (const k of keys) { try { await storage.delete(k); } catch { storageErrors++; } }
    for (const a of assets) if (a.hlsPrefix) { try { await storage.deletePrefix(`hls/${a.hlsPrefix}/`); } catch { storageErrors++; } }
    await prisma.$transaction([
      prisma.section.deleteMany({ where: { courseId: c.id } }), // lessons, quizzes, files and progress go with their sections
      prisma.courseResource.deleteMany({ where: { courseId: c.id } }),
      prisma.courseRevision.deleteMany({ where: { courseId: c.id } }),
      prisma.cartItem.deleteMany({ where: { courseId: c.id } }),
      prisma.careerPathStep.deleteMany({ where: { courseId: c.id } }),
      prisma.videoAsset.deleteMany({ where: { id: { in: assetIds } } }),
      prisma.course.update({ where: { id: c.id }, data: { purgedAt: now, promoVideoAssetId: null, featuredAt: null } }),
    ]);
    await audit.log({ actorId: null, action: 'course.purged', targetType: 'course', targetId: c.id, meta: { title: c.title, videos: assets.length, files: keys.length, storageErrors, keptShared: sharedAssets.size + sharedKeys.size } });
    purged++;
  }
  return { purged, waiting };
}
