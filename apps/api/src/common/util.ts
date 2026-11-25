import { randomBytes } from 'node:crypto';

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'course'
  );
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** Commission and instructor share for one line. Commission rounds half up; share = price − commission. */
export function splitAmount(priceCents: number, commissionBps: number) {
  if (!Number.isInteger(priceCents) || priceCents < 0) throw new Error('priceCents must be a non-negative integer');
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10000) throw new Error('commissionBps must be 0..10000');
  const commissionCents = Math.round((priceCents * commissionBps) / 10000);
  return { commissionCents, instructorShareCents: priceCents - commissionCents };
}

/** Prisma skip/take for 1-based pages. */
export const page = (p: number, size: number) => ({ skip: (p - 1) * size, take: size });
export const paged = <T>(items: T[], total: number, q: { page: number; pageSize: number }) => ({ items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) });
