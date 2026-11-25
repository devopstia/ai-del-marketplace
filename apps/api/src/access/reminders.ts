import type { JobsService } from '../common/jobs';
import type { PrismaService } from '../common/prisma.service';

const DAY = 86_400_000;
/** Reminder steps before access ends, then a notice when it ended (each sent once per access year). */
const STEPS = [
  { key: '30d', before: 30 * DAY, template: 'access-expiring' },
  { key: '7d', before: 7 * DAY, template: 'access-expiring' },
  { key: '1d', before: 1 * DAY, template: 'access-expiring' },
  { key: 'expired', before: 0, template: 'access-expired' },
] as const;

/**
 * Hourly (one-year access, owner 2026-11-25): emails students whose course access ends in 30, 7 or 1 days, and when it
 * ended, inviting them to renew at the current price. No charges are made. Idempotent: `remindersSent` records each
 * step; a renewal resets it.
 */
export async function sendAccessReminders(prisma: PrismaService, jobs: JobsService, now = new Date()) {
  let sent = 0;
  const due = await prisma.enrollment.findMany({
    where: { revokedAt: null, accessExpiresAt: { not: null, lte: new Date(now.getTime() + 30 * DAY), gt: new Date(now.getTime() - 7 * DAY) } },
    include: { user: { select: { email: true, name: true, status: true } }, course: { select: { title: true, slug: true } } },
    take: 2000,
  });
  for (const e of due) {
    if (e.user.status !== 'active') continue;
    const left = e.accessExpiresAt!.getTime() - now.getTime();
    // The most urgent step that applies and hasn't been sent (no backlog of older reminders).
    const step = [...STEPS].reverse().find((s) => (s.key === 'expired' ? left <= 0 : left <= s.before && left > 0));
    if (!step || e.remindersSent.includes(step.key)) continue;
    const marked = await prisma.enrollment.updateMany({
      where: { userId: e.userId, courseId: e.courseId, NOT: { remindersSent: { has: step.key } } },
      data: { remindersSent: { set: [...new Set([...e.remindersSent, ...STEPS.slice(0, STEPS.indexOf(step) + 1).map((s) => s.key)])] } },
    });
    if (!marked.count) continue;
    await jobs.sendEmail({
      to: e.user.email,
      template: step.template,
      data: { name: e.user.name, course: e.course.title, slug: e.course.slug, expiresAt: e.accessExpiresAt, daysLeft: Math.max(0, Math.ceil(left / DAY)) },
    });
    sent++;
  }
  return { sent };
}
