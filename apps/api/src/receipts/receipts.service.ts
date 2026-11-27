import { Injectable, Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import { AuditService } from '../common/audit.service';
import type { Actor } from '../common/auth-context';
import { badRequest, notFound } from '../common/errors';
import { JobsService } from '../common/jobs';
import { PrismaService } from '../common/prisma.service';
import { env } from '../config/env';
import { StripeService } from '../commerce/stripe.service';
import { buildReceipt, RECEIPT_STATUSES, type Company, type Receipt } from './receipt-model';
import { RECEIPT_NUMBER_RE, orderRefToIdPrefix } from './receipt-number';
import { renderReceiptPdf, type Paper } from './receipt-pdf';

export const COMPANY_KEY = 'company_details';

const RECEIPT_SELECT = {
  id: true, status: true, totalCents: true, currency: true, provider: true, createdAt: true, paidAt: true, taxCents: true, receiptNumber: true,
  stripePaymentIntentId: true, stripeChargeId: true, paymentBrand: true, paymentLast4: true, paymentWallet: true, userId: true,
  user: { select: { name: true, email: true } },
  lines: { orderBy: { id: 'asc' as const }, select: { priceCents: true, listPriceCents: true, saleKind: true, refundedAt: true, course: { select: { title: true } } } },
};

/**
 * Receipts (owner 2026-11-27, docs/RECEIPTS.md): the company details from Super Admin settings, the receipt view model,
 * the PDF, and the masked payment method from Stripe. Private: only the buyer and admins with "orders.view" reach these
 * (enforced by the callers' routes and `forUser`). Never changes money: it only reads orders, lines and refunds.
 */
@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger('Receipts');
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
  ) {}

  // ---------- company details (Super Admin › Settings › Company details) ----------
  defaults(): Company {
    return { legalName: 'DevOps Easy Learning', address: [], supportEmail: env().EMAIL_REPLY_TO || 'support@devopseasylearning.com', website: new URL(env().WEB_URL).host, taxId: null };
  }

  async company(): Promise<Company> {
    const d = this.defaults();
    const row = await this.prisma.platformSetting.findUnique({ where: { key: COMPANY_KEY } });
    const v = (row?.value ?? {}) as Partial<{ legalName: string; address: string; supportEmail: string; website: string; taxId: string }>;
    const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
    return {
      legalName: str(v.legalName) || d.legalName,
      // Business address and tax ID only when the Super Admin set them: never invented.
      address: str(v.address).split('\n').map((s) => s.trim()).filter(Boolean),
      supportEmail: str(v.supportEmail) || d.supportEmail,
      website: str(v.website) || d.website,
      taxId: str(v.taxId) || null,
    };
  }

  async companySettings() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: COMPANY_KEY } });
    const v = (row?.value ?? {}) as Record<string, unknown>;
    const d = this.defaults();
    return { legalName: String(v.legalName ?? ''), address: String(v.address ?? ''), supportEmail: String(v.supportEmail ?? ''), website: String(v.website ?? ''), taxId: String(v.taxId ?? ''), defaults: { legalName: d.legalName, supportEmail: d.supportEmail, website: d.website } };
  }

  async setCompany(a: Actor, input: { legalName?: string; address?: string; supportEmail?: string; website?: string; taxId?: string }) {
    const before = await this.companySettings();
    const value = {
      legalName: (input.legalName ?? before.legalName).trim(),
      address: (input.address ?? before.address).trim(),
      supportEmail: (input.supportEmail ?? before.supportEmail).trim(),
      website: (input.website ?? before.website).trim().replace(/^https?:\/\//, '').replace(/\/$/, ''),
      taxId: (input.taxId ?? before.taxId).trim(),
    };
    if (value.supportEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.supportEmail)) throw badRequest('Enter a valid support email', 'invalid_email', [{ field: 'supportEmail', message: 'Enter a valid email address' }]);
    await this.prisma.platformSetting.upsert({ where: { key: COMPANY_KEY }, create: { key: COMPANY_KEY, value }, update: { value } });
    const { defaults: _d, ...prev } = before;
    await this.audit.log({ actorId: a.user.id, action: 'settings.company_updated', targetType: 'settings', targetId: COMPANY_KEY, ip: a.ip, meta: { before: prev, after: value } });
    return this.companySettings();
  }

  // ---------- receipts ----------
  private async load(where: { id: string; userId?: string }) {
    const o = await this.prisma.order.findFirst({ where, select: RECEIPT_SELECT });
    // Only paid or refunded orders have a receipt; a pending or failed order is "not found" to everyone.
    if (!o || !(RECEIPT_STATUSES as readonly string[]).includes(o.status)) throw notFound('Receipt');
    return o;
  }

  private async receiptOf(o: Awaited<ReturnType<ReceiptsService['load']>>): Promise<Receipt> {
    if (o.provider === 'stripe' && !o.paymentBrand) {
      const got = await this.capturePaymentMethod(o.id).catch(() => null);
      if (got) Object.assign(o, got);
    }
    return buildReceipt(o, await this.company());
  }

  /** The buyer's own receipt. Another user's order answers 404 (no hint that it exists). */
  async forUser(userId: string, orderId: string) {
    return this.receiptOf(await this.load({ id: orderId, userId }));
  }

  /** Admins with "orders.view" (checked by the route). */
  async forAdmin(orderId: string) {
    return this.receiptOf(await this.load({ id: orderId }));
  }

  async pdf(r: Receipt, paper: Paper) {
    const { pdf } = await renderReceiptPdf(r, paper);
    return { pdf, filename: `${r.receiptNumber}.pdf` };
  }

  /** Admin: send the receipt email again (audited; each resend is its own email). */
  async resend(a: Actor, orderId: string) {
    const r = await this.forAdmin(orderId);
    await this.jobs.sendEmail({
      to: r.customer.email, template: 'order-receipt', dedupeKey: `receipt-resend:${orderId}:${Date.now()}`,
      data: { orderId, receiptNumber: r.receiptNumber, name: r.customer.name, total: r.totalCents, lines: r.lines.map((l) => ({ title: l.title, priceCents: l.amountCents, accessUntil: null })), resent: true },
    });
    await this.audit.log({ actorId: a.user.id, action: 'order.receipt_resent', targetType: 'order', targetId: orderId, ip: a.ip, meta: { receiptNumber: r.receiptNumber } });
    return { sent: true, to: r.customer.email };
  }

  /** Admin search helper: a receipt number or an order reference → the order id, or null. */
  async findOrderId(term: string): Promise<string | null> {
    const t = term.trim().toUpperCase();
    if (RECEIPT_NUMBER_RE.test(t)) return (await this.prisma.order.findUnique({ where: { receiptNumber: t }, select: { id: true } }))?.id ?? null;
    const prefix = orderRefToIdPrefix(t);
    if (prefix) return (await this.prisma.order.findFirst({ where: { id: { startsWith: prefix } }, select: { id: true } }))?.id ?? null;
    return null;
  }

  /**
   * The masked payment method (brand, last 4, wallet) from Stripe, stored once on the order. Reads the charge (or the
   * PaymentIntent's latest charge); never stores or returns more than the last four digits.
   */
  async capturePaymentMethod(orderId: string): Promise<{ paymentBrand: string | null; paymentLast4: string | null; paymentWallet: string | null } | null> {
    if (!this.stripe.configured) return null;
    const o = await this.prisma.order.findUnique({ where: { id: orderId }, select: { provider: true, paymentBrand: true, stripeChargeId: true, stripePaymentIntentId: true } });
    if (!o || o.provider !== 'stripe' || o.paymentBrand) return null;
    let charge: Stripe.Charge | null = null;
    if (o.stripeChargeId) charge = await this.stripe.client.charges.retrieve(o.stripeChargeId);
    else if (o.stripePaymentIntentId) {
      const pi = await this.stripe.client.paymentIntents.retrieve(o.stripePaymentIntentId, { expand: ['latest_charge'] });
      charge = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null;
    }
    const d = charge?.payment_method_details;
    if (!d) return null;
    const card = d.card;
    const data = {
      paymentBrand: card?.brand ?? d.type ?? null,
      paymentLast4: card?.last4 && /^\d{4}$/.test(card.last4) ? card.last4 : null,
      paymentWallet: card?.wallet?.type ?? (d.type === 'link' ? 'link' : null),
    };
    await this.prisma.order.update({ where: { id: orderId }, data });
    this.logger.log(`payment method stored for ${orderId}`);
    return data;
  }
}
