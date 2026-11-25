import { Injectable } from '@nestjs/common';
import { PRICE_MIN_CENTS } from './pricing';
import { PrismaService } from './prisma.service';

/**
 * Sales and promotions (owner decisions 2026-11-25):
 *  - an instructor's own sale sets a fixed sale price on one course for a period;
 *  - a marketplace-wide promotion takes a percentage off every paid course in scope for a period;
 *    instructors are included unless they opted the course out; DEL's own courses are always included;
 *  - discounts never stack: the lowest price wins;
 *  - nothing is written to the course, so the regular price returns by itself the moment a sale ends.
 * The rules for creating a sale (at least 10% off, not below the minimum price, up to 31 days) live in PromotionsService.
 */

export type SaleKind = 'course_sale' | 'promotion';

export interface PriceInput {
  id: string;
  priceCents: number;
  categoryId: string | null;
  promoOptOut: boolean;
  /** DEL's own courses: always part of marketplace promotions. */
  platformOwned: boolean;
}
export interface ActiveCourseSale { id: string; courseId: string; salePriceCents: number; endsAt: Date }
export interface ActivePromotion { id: string; name: string; percentOff: number; endsAt: Date; scope: 'all' | 'categories' | 'courses'; categoryIds: string[]; courseIds: string[] }

export interface SaleInfo { kind: SaleKind; id: string; name: string | null; endsAt: Date; percentOff: number }
export interface CurrentPrice { listPriceCents: number; priceCents: number; sale: SaleInfo | null }

/** A promotion's price for a course: the percentage off, rounded to the cent, never below the platform minimum. */
export function promotionPriceCents(listCents: number, percentOff: number): number {
  return Math.max(PRICE_MIN_CENTS, Math.round((listCents * (100 - percentOff)) / 100));
}

export function promotionApplies(p: ActivePromotion, c: PriceInput): boolean {
  if (c.priceCents <= 0) return false;
  if (c.promoOptOut && !c.platformOwned) return false;
  if (p.scope === 'categories') return !!c.categoryId && p.categoryIds.includes(c.categoryId);
  if (p.scope === 'courses') return p.courseIds.includes(c.id);
  return true;
}

const percent = (list: number, price: number) => Math.round(((list - price) * 100) / list);

/** The price a learner pays right now: the lowest of the regular price, the course's own sale and every promotion in scope. */
export function currentPrice(c: PriceInput, sale: ActiveCourseSale | undefined, promotions: ActivePromotion[]): CurrentPrice {
  const list = c.priceCents;
  let best: CurrentPrice = { listPriceCents: list, priceCents: list, sale: null };
  if (list <= 0) return best;
  // The instructor's sale first, so it wins a tie with a promotion.
  if (sale && sale.salePriceCents < best.priceCents) {
    best = { listPriceCents: list, priceCents: sale.salePriceCents, sale: { kind: 'course_sale', id: sale.id, name: null, endsAt: sale.endsAt, percentOff: percent(list, sale.salePriceCents) } };
  }
  for (const p of promotions) {
    if (!promotionApplies(p, c)) continue;
    const price = promotionPriceCents(list, p.percentOff);
    if (price < best.priceCents) {
      best = { listPriceCents: list, priceCents: price, sale: { kind: 'promotion', id: p.id, name: p.name, endsAt: p.endsAt, percentOff: percent(list, price) } };
    }
  }
  return best;
}

/** Prisma select that carries everything `currentPrice` needs from a course row. */
export const priceSelect = {
  id: true,
  priceCents: true,
  categoryId: true,
  promoOptOut: true,
  instructor: { select: { instructorProfile: { select: { isPlatform: true } } } },
} as const;

export interface PriceRow { id: string; priceCents: number; categoryId: string | null; promoOptOut: boolean; instructor: { instructorProfile: { isPlatform: boolean } | null } }
export const toPriceInput = (r: PriceRow): PriceInput => ({
  id: r.id, priceCents: r.priceCents, categoryId: r.categoryId, promoOptOut: r.promoOptOut, platformOwned: !!r.instructor.instructorProfile?.isPlatform,
});

@Injectable()
export class SalePricingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Marketplace promotions running at `now`. */
  activePromotions(now = new Date()): Promise<ActivePromotion[]> {
    return this.prisma.promotion.findMany({
      where: { canceledAt: null, startsAt: { lte: now }, endsAt: { gt: now } },
      select: { id: true, name: true, percentOff: true, endsAt: true, scope: true, categoryIds: true, courseIds: true },
    });
  }

  /** Current prices for these courses, keyed by course id. */
  async prices(courses: PriceInput[], now = new Date()): Promise<Map<string, CurrentPrice>> {
    const out = new Map<string, CurrentPrice>();
    if (!courses.length) return out;
    const [sales, promotions] = await Promise.all([
      this.prisma.courseSale.findMany({
        where: { courseId: { in: courses.map((c) => c.id) }, canceledAt: null, startsAt: { lte: now }, endsAt: { gt: now } },
        select: { id: true, courseId: true, salePriceCents: true, endsAt: true },
      }),
      this.activePromotions(now),
    ]);
    const byCourse = new Map<string, ActiveCourseSale>();
    // Overlaps are prevented when sales are saved; if two ever overlap, the lower price is used.
    for (const s of sales) if (!byCourse.has(s.courseId) || s.salePriceCents < byCourse.get(s.courseId)!.salePriceCents) byCourse.set(s.courseId, s);
    for (const c of courses) out.set(c.id, currentPrice(c, byCourse.get(c.id), promotions));
    return out;
  }

  /** Current prices for course ids (loads what it needs). */
  async pricesForIds(ids: string[], now = new Date()): Promise<Map<string, CurrentPrice>> {
    if (!ids.length) return new Map();
    const rows = await this.prisma.course.findMany({ where: { id: { in: ids } }, select: priceSelect });
    return this.prices(rows.map(toPriceInput), now);
  }
}
