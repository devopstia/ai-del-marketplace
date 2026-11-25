import { Injectable } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { Actor } from '../common/auth-context';
import { badRequest, conflict, notFound } from '../common/errors';
import { PRICE_MIN_CENTS, usd } from '../common/pricing';
import { PrismaService } from '../common/prisma.service';
import { priceSelect, promotionApplies, SalePricingService, toPriceInput } from '../common/sale-pricing';

/** Instructor sale rules (owner, 2026-11-25): at least 10% off, never below the minimum price, up to 31 days, one at a time. */
export const SALE_MIN_PERCENT_OFF = 10;
export const SALE_MAX_DAYS = 31;
/** Marketplace promotions: 5–90% off, up to 90 days. */
export const PROMO_MIN_PERCENT = 5;
export const PROMO_MAX_PERCENT = 90;
export const PROMO_MAX_DAYS = 90;
const DAY = 86400_000;
/** A start a few seconds in the past ("start now" from a slow form) is accepted. */
const START_GRACE_MS = 5 * 60_000;
const MAX_LEAD_DAYS = 365;

export type Status = 'scheduled' | 'active' | 'ended' | 'canceled';
export const statusOf = (r: { startsAt: Date; endsAt: Date; canceledAt: Date | null }, now = new Date()): Status =>
  r.canceledAt ? 'canceled' : r.endsAt <= now ? 'ended' : r.startsAt > now ? 'scheduled' : 'active';

/** Highest sale price that is still at least 10% off. */
export const maxSalePriceCents = (listCents: number) => Math.floor((listCents * (100 - SALE_MIN_PERCENT_OFF)) / 100);

export interface SaleInput { salePriceCents: number; startsAt?: Date; endsAt: Date }
export interface PromotionInput { name: string; percentOff: number; startsAt?: Date; endsAt: Date; scope: 'all' | 'categories' | 'courses'; categoryIds?: string[]; courseIds?: string[] }

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pricing: SalePricingService,
  ) {}

  // ---------- instructor: their own course sales ----------

  /** Ownership gate for every instructor sale action: the course must belong to the signed-in instructor. */
  private async ownCourse(userId: string, courseId: string) {
    const c = await this.prisma.course.findFirst({
      where: { id: courseId, instructorId: userId },
      select: { ...priceSelect, title: true, slug: true, status: true },
    });
    if (!c) throw notFound('Course');
    return c;
  }

  private saleView(s: { id: string; courseId: string; salePriceCents: number; startsAt: Date; endsAt: Date; canceledAt: Date | null; createdAt: Date }, listCents: number) {
    return {
      id: s.id,
      courseId: s.courseId,
      salePriceCents: s.salePriceCents,
      listPriceCents: listCents,
      percentOff: listCents > 0 ? Math.round(((listCents - s.salePriceCents) * 100) / listCents) : 0,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      canceledAt: s.canceledAt,
      status: statusOf(s),
      createdAt: s.createdAt,
    };
  }

  /** Every course of the instructor with its price now, its sales and the marketplace promotions that reach it. */
  async instructorOverview(userId: string) {
    const now = new Date();
    const [courses, promotions] = await Promise.all([
      this.prisma.course.findMany({
        where: { instructorId: userId, status: { not: 'rejected' } },
        orderBy: { createdAt: 'desc' },
        select: { ...priceSelect, title: true, slug: true, status: true, sales: { where: { canceledAt: null, endsAt: { gt: now } }, orderBy: { startsAt: 'asc' } } },
      }),
      this.pricing.activePromotions(now),
    ]);
    const prices = await this.pricing.prices(courses.map(toPriceInput), now);
    return {
      rules: { minPercentOff: SALE_MIN_PERCENT_OFF, maxDays: SALE_MAX_DAYS, minPriceCents: PRICE_MIN_CENTS },
      promotions: promotions.map((p) => ({ id: p.id, name: p.name, percentOff: p.percentOff, endsAt: p.endsAt, scope: p.scope })),
      courses: courses.map((c) => {
        const input = toPriceInput(c);
        return {
          id: c.id,
          title: c.title,
          slug: c.slug,
          status: c.status,
          priceCents: c.priceCents,
          maxSalePriceCents: c.priceCents > 0 ? maxSalePriceCents(c.priceCents) : null,
          current: prices.get(c.id),
          promoOptOut: c.promoOptOut,
          platformOwned: input.platformOwned,
          inPromotions: promotions.filter((p) => promotionApplies(p, input)).map((p) => p.id),
          upcoming: c.sales.map((s) => this.saleView(s, c.priceCents)),
        };
      }),
    };
  }

  async listSales(userId: string, courseId: string) {
    const c = await this.ownCourse(userId, courseId);
    const sales = await this.prisma.courseSale.findMany({ where: { courseId }, orderBy: { startsAt: 'desc' }, take: 50 });
    return { course: { id: c.id, title: c.title, priceCents: c.priceCents, maxSalePriceCents: c.priceCents > 0 ? maxSalePriceCents(c.priceCents) : null }, items: sales.map((s) => this.saleView(s, c.priceCents)) };
  }

  /** Shared rules for a sale's price and period; `existingStart` is set when the sale has already started. */
  private async checkSale(course: { id: string; priceCents: number }, input: SaleInput, opts: { ignoreSaleId?: string; existingStart?: Date }) {
    const now = Date.now();
    if (course.priceCents <= 0) throw badRequest('Free courses cannot go on sale', 'free_course');
    const max = maxSalePriceCents(course.priceCents);
    if (!Number.isInteger(input.salePriceCents) || input.salePriceCents < PRICE_MIN_CENTS || input.salePriceCents > max) {
      throw badRequest(`Sale price must be between ${usd(PRICE_MIN_CENTS)} and ${usd(max)} (at least ${SALE_MIN_PERCENT_OFF}% off ${usd(course.priceCents)})`, 'sale_price');
    }
    if (max < PRICE_MIN_CENTS) throw badRequest(`This course's price is too low for a sale (minimum price ${usd(PRICE_MIN_CENTS)})`, 'sale_price');
    const startsAt = opts.existingStart ?? input.startsAt ?? new Date(now);
    if (!opts.existingStart && startsAt.getTime() < now - START_GRACE_MS) throw badRequest('The start cannot be in the past', 'sale_start');
    if (startsAt.getTime() > now + MAX_LEAD_DAYS * DAY) throw badRequest('A sale can be scheduled up to a year ahead', 'sale_start');
    if (input.endsAt <= startsAt || input.endsAt.getTime() <= now) throw badRequest('The end must be after the start and in the future', 'sale_end');
    if (input.endsAt.getTime() - startsAt.getTime() > SALE_MAX_DAYS * DAY) throw badRequest(`A sale can last up to ${SALE_MAX_DAYS} days`, 'sale_length');
    const overlap = await this.prisma.courseSale.findFirst({
      where: { courseId: course.id, canceledAt: null, id: opts.ignoreSaleId ? { not: opts.ignoreSaleId } : undefined, startsAt: { lt: input.endsAt }, endsAt: { gt: startsAt } },
    });
    if (overlap) throw conflict('This course already has a sale in that period. Edit or cancel it first.', 'sale_overlap');
    return { startsAt, endsAt: input.endsAt, salePriceCents: input.salePriceCents };
  }

  async createSale(a: Actor, courseId: string, input: SaleInput) {
    const c = await this.ownCourse(a.user.id, courseId);
    const data = await this.checkSale(c, input, {});
    const sale = await this.prisma.courseSale.create({ data: { courseId, ...data, createdById: a.user.id } });
    await this.audit.log({ actorId: a.user.id, action: 'course_sale.created', targetType: 'course', targetId: courseId, ip: a.ip, meta: { saleId: sale.id, ...data, listPriceCents: c.priceCents } });
    return this.saleView(sale, c.priceCents);
  }

  /** Scheduled sales can change everything; a running sale keeps its start (price and end can change). */
  async updateSale(a: Actor, courseId: string, saleId: string, input: SaleInput) {
    const c = await this.ownCourse(a.user.id, courseId);
    const sale = await this.prisma.courseSale.findFirst({ where: { id: saleId, courseId } });
    if (!sale) throw notFound('Sale');
    const st = statusOf(sale);
    if (st === 'ended' || st === 'canceled') throw conflict(`This sale has ${st === 'ended' ? 'ended' : 'been cancelled'} and cannot be changed`, 'sale_closed');
    const data = await this.checkSale(c, input, { ignoreSaleId: saleId, existingStart: st === 'active' ? sale.startsAt : undefined });
    const updated = await this.prisma.courseSale.update({ where: { id: saleId }, data });
    await this.audit.log({ actorId: a.user.id, action: 'course_sale.updated', targetType: 'course', targetId: courseId, ip: a.ip, meta: { saleId, before: { salePriceCents: sale.salePriceCents, startsAt: sale.startsAt, endsAt: sale.endsAt }, after: data } });
    return this.saleView(updated, c.priceCents);
  }

  async cancelSale(a: Actor, courseId: string, saleId: string) {
    const c = await this.ownCourse(a.user.id, courseId);
    return this.cancel(a, saleId, c.id, c.priceCents, null);
  }

  private async cancel(a: Actor, saleId: string, courseId: string | null, listCents: number | null, note: string | null) {
    const sale = await this.prisma.courseSale.findFirst({ where: { id: saleId, ...(courseId ? { courseId } : {}) }, include: { course: { select: { priceCents: true } } } });
    if (!sale) throw notFound('Sale');
    const st = statusOf(sale);
    if (st === 'ended' || st === 'canceled') throw conflict(`This sale has already ${st === 'ended' ? 'ended' : 'been cancelled'}`, 'sale_closed');
    const updated = await this.prisma.courseSale.update({ where: { id: saleId }, data: { canceledAt: new Date(), canceledById: a.user.id, cancelNote: note } });
    await this.audit.log({ actorId: a.user.id, action: 'course_sale.canceled', targetType: 'course', targetId: sale.courseId, ip: a.ip, meta: { saleId, was: st, note } });
    return this.saleView(updated, listCents ?? sale.course.priceCents);
  }

  /** Leave a course out of (or back into) marketplace-wide promotions. DEL's own courses are always included. */
  async setOptOut(a: Actor, courseId: string, optOut: boolean) {
    const c = await this.ownCourse(a.user.id, courseId);
    if (toPriceInput(c).platformOwned) throw badRequest('DevOps Easy Learning courses are always part of marketplace promotions', 'platform_course');
    await this.prisma.course.update({ where: { id: courseId }, data: { promoOptOut: optOut } });
    await this.audit.log({ actorId: a.user.id, action: 'course.promo_opt_out', targetType: 'course', targetId: courseId, ip: a.ip, meta: { promoOptOut: optOut } });
    return { courseId, promoOptOut: optOut };
  }

  // ---------- super admin: marketplace promotions and oversight ----------

  private async checkPromotion(input: PromotionInput, existingStart?: Date) {
    const now = Date.now();
    const name = input.name.trim();
    if (name.length < 3) throw badRequest('Give the promotion a name of at least 3 characters', 'promo_name');
    if (!Number.isInteger(input.percentOff) || input.percentOff < PROMO_MIN_PERCENT || input.percentOff > PROMO_MAX_PERCENT) {
      throw badRequest(`Discount must be between ${PROMO_MIN_PERCENT}% and ${PROMO_MAX_PERCENT}%`, 'promo_percent');
    }
    const startsAt = existingStart ?? input.startsAt ?? new Date(now);
    if (!existingStart && startsAt.getTime() < now - START_GRACE_MS) throw badRequest('The start cannot be in the past', 'promo_start');
    if (startsAt.getTime() > now + MAX_LEAD_DAYS * DAY) throw badRequest('A promotion can be scheduled up to a year ahead', 'promo_start');
    if (input.endsAt <= startsAt || input.endsAt.getTime() <= now) throw badRequest('The end must be after the start and in the future', 'promo_end');
    if (input.endsAt.getTime() - startsAt.getTime() > PROMO_MAX_DAYS * DAY) throw badRequest(`A promotion can last up to ${PROMO_MAX_DAYS} days`, 'promo_length');
    const categoryIds = input.scope === 'categories' ? [...new Set(input.categoryIds ?? [])] : [];
    const courseIds = input.scope === 'courses' ? [...new Set(input.courseIds ?? [])] : [];
    if (input.scope === 'categories') {
      if (!categoryIds.length) throw badRequest('Pick at least one topic', 'promo_scope');
      if ((await this.prisma.category.count({ where: { id: { in: categoryIds } } })) !== categoryIds.length) throw badRequest('Unknown topic', 'promo_scope');
    }
    if (input.scope === 'courses') {
      if (!courseIds.length) throw badRequest('Pick at least one course', 'promo_scope');
      if ((await this.prisma.course.count({ where: { id: { in: courseIds } } })) !== courseIds.length) throw badRequest('Unknown course', 'promo_scope');
    }
    return { name, percentOff: input.percentOff, startsAt, endsAt: input.endsAt, scope: input.scope, categoryIds, courseIds };
  }

  /** How many published paid courses a promotion reaches (opted-out instructor courses excluded). */
  private async reach(p: { scope: 'all' | 'categories' | 'courses'; categoryIds: string[]; courseIds: string[]; percentOff: number }) {
    const rows = await this.prisma.course.findMany({ where: { status: 'published', priceCents: { gt: 0 } }, select: priceSelect });
    const promo = { id: '', name: '', endsAt: new Date(), ...p };
    return rows.filter((r) => promotionApplies(promo, toPriceInput(r))).length;
  }

  private async promotionView(p: { id: string; name: string; percentOff: number; startsAt: Date; endsAt: Date; scope: 'all' | 'categories' | 'courses'; categoryIds: string[]; courseIds: string[]; canceledAt: Date | null; createdAt: Date }) {
    return { ...p, status: statusOf(p), courseCount: await this.reach(p) };
  }

  async listPromotions() {
    const rows = await this.prisma.promotion.findMany({ orderBy: [{ startsAt: 'desc' }], take: 100 });
    return { rules: { minPercent: PROMO_MIN_PERCENT, maxPercent: PROMO_MAX_PERCENT, maxDays: PROMO_MAX_DAYS }, items: await Promise.all(rows.map((r) => this.promotionView(r))) };
  }

  async createPromotion(a: Actor, input: PromotionInput) {
    const data = await this.checkPromotion(input);
    const p = await this.prisma.promotion.create({ data: { ...data, createdById: a.user.id } });
    await this.audit.log({ actorId: a.user.id, action: 'promotion.created', targetType: 'promotion', targetId: p.id, ip: a.ip, meta: data });
    return this.promotionView(p);
  }

  async updatePromotion(a: Actor, id: string, input: PromotionInput) {
    const p = await this.prisma.promotion.findUnique({ where: { id } });
    if (!p) throw notFound('Promotion');
    const st = statusOf(p);
    if (st === 'ended' || st === 'canceled') throw conflict(`This promotion has ${st === 'ended' ? 'ended' : 'been cancelled'} and cannot be changed`, 'promo_closed');
    const data = await this.checkPromotion(input, st === 'active' ? p.startsAt : undefined);
    const updated = await this.prisma.promotion.update({ where: { id }, data });
    await this.audit.log({ actorId: a.user.id, action: 'promotion.updated', targetType: 'promotion', targetId: id, ip: a.ip, meta: { before: { name: p.name, percentOff: p.percentOff, startsAt: p.startsAt, endsAt: p.endsAt, scope: p.scope }, after: data } });
    return this.promotionView(updated);
  }

  async cancelPromotion(a: Actor, id: string) {
    const p = await this.prisma.promotion.findUnique({ where: { id } });
    if (!p) throw notFound('Promotion');
    const st = statusOf(p);
    if (st === 'ended' || st === 'canceled') throw conflict(`This promotion has already ${st === 'ended' ? 'ended' : 'been cancelled'}`, 'promo_closed');
    const updated = await this.prisma.promotion.update({ where: { id }, data: { canceledAt: new Date() } });
    await this.audit.log({ actorId: a.user.id, action: 'promotion.canceled', targetType: 'promotion', targetId: id, ip: a.ip, meta: { was: st } });
    return this.promotionView(updated);
  }

  /** Instructor sales across the marketplace, newest first: running and scheduled by default. */
  async listCourseSales(status: 'open' | 'all') {
    const now = new Date();
    const rows = await this.prisma.courseSale.findMany({
      where: status === 'open' ? { canceledAt: null, endsAt: { gt: now } } : {},
      orderBy: { startsAt: 'desc' },
      take: 200,
      include: { course: { select: { id: true, title: true, slug: true, priceCents: true, instructor: { select: { id: true, name: true } } } } },
    });
    return { items: rows.map((s) => ({ ...this.saleView(s, s.course.priceCents), course: { id: s.course.id, title: s.course.title, slug: s.course.slug }, instructor: s.course.instructor })) };
  }

  /** A super admin stops an instructor's sale (for example a mistaken price); the note is kept in the audit log. */
  adminCancelSale(a: Actor, saleId: string, note: string) {
    return this.cancel(a, saleId, null, null, note);
  }
}
