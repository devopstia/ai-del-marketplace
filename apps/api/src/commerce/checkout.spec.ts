import { devPaymentsEnabled, resetEnvCache } from '../config/env';
import { CommerceService } from './commerce.service';
import { TERMS_VERSION } from './terms';

const noSales: any = { prices: async () => new Map(), pricesForIds: async () => new Map() };
const T = { acceptTerms: true, termsVersion: TERMS_VERSION };

describe('CommerceService.checkout (order lines + commission)', () => {
  const items = [
    { courseId: 'c-nadia', course: { id: 'c-nadia', title: 'n8n', priceCents: 4999, currency: 'usd', status: 'published', instructorId: 'i-nadia' } },
    { courseId: 'c-del', course: { id: 'c-del', title: 'CI/CD', priceCents: 6999, currency: 'usd', status: 'published', instructorId: 'i-del' } },
  ];

  function build(opts: { commissionBps: number; devPayments?: boolean; stripe?: boolean; nadia?: { commissionBps?: number | null; payToPlatform?: boolean }; pricing?: any }) {
    process.env.DEV_TEST_PAYMENTS = String(opts.devPayments ?? true);
    resetEnvCache();
    const created: any[] = [];
    const prisma: any = {
      cartItem: { findMany: jest.fn(async () => items), deleteMany: jest.fn() },
      enrollment: { findMany: jest.fn(async () => []) },
      instructorProfile: {
        findMany: jest.fn(async () => [
          { userId: 'i-del', isPlatform: true, commissionBps: null, payToPlatform: false },
          { userId: 'i-nadia', isPlatform: false, commissionBps: opts.nadia?.commissionBps ?? null, payToPlatform: !!opts.nadia?.payToPlatform },
        ]),
      },
      order: {
        create: jest.fn(async ({ data }: any) => {
          created.push(data);
          return { id: 'o1', ...data, lines: data.lines.create };
        }),
      },
    };
    const svc = new CommerceService(
      prisma,
      { log: jest.fn() } as any,
      { commissionBps: jest.fn(async () => opts.commissionBps) } as any,
      { configured: !!opts.stripe } as any,
      { fulfil: jest.fn() } as any,
      { imageUrl: () => null } as any,
      opts.pricing ?? noSales,
    );
    return { svc, created };
  }

  it('applies the platform commission to third-party lines and keeps 100% of platform courses', async () => {
    const { svc, created } = build({ commissionBps: 1500 });
    const r = await svc.checkout({ user: { id: 'u1', email: 'u@x', name: 'U', roles: ['student'] }, ip: null }, { immediateAccessConsent: true, ...T });
    expect(r.mode).toBe('test');
    expect(r.url).toMatch(/\/checkout\/test-payment\?order=o1$/);
    const [nadia, del] = created[0].lines.create;
    expect(created[0].totalCents).toBe(11998);
    expect(nadia).toMatchObject({ priceCents: 4999, commissionBps: 1500, instructorShareCents: 4249, transferStatus: 'pending' });
    expect(del).toMatchObject({ priceCents: 6999, commissionBps: 10000, instructorShareCents: 0, transferStatus: 'none' });
  });

  it('a sale running now sets the line price, keeps the regular price, and the split uses the sale price', async () => {
    const endsAt = new Date(Date.now() + 86400_000);
    const pricing = {
      pricesForIds: async () => new Map([['c-nadia', { listPriceCents: 4999, priceCents: 2999, sale: { kind: 'course_sale', id: 's1', name: null, endsAt, percentOff: 40 } }]]),
    };
    const { svc, created } = build({ commissionBps: 2000, pricing });
    await svc.checkout({ user: { id: 'u1', email: 'u@x', name: 'U', roles: ['student'] }, ip: null }, { immediateAccessConsent: true, ...T });
    const [nadia, del] = created[0].lines.create;
    expect(created[0].totalCents).toBe(2999 + 6999);
    // 80% of 2999 (before the Stripe fee is known)
    expect(nadia).toMatchObject({ priceCents: 2999, listPriceCents: 4999, saleKind: 'course_sale', saleId: 's1', instructorShareCents: 2399 });
    expect(del).toMatchObject({ priceCents: 6999, listPriceCents: 6999, saleKind: null, saleId: null });
  });

  it('default commission 0: instructor share is the full price', async () => {
    const { svc, created } = build({ commissionBps: 0 });
    await svc.checkout({ user: { id: 'u1', email: 'u@x', name: 'U', roles: ['student'] }, ip: null }, { immediateAccessConsent: true, ...T });
    expect(created[0].lines.create[0]).toMatchObject({ instructorShareCents: 4999, commissionBps: 0 });
  });

  it('per-instructor agreement: override rate, and "pay to DEL" lines never transfer', async () => {
    const o = build({ commissionBps: 2000, nadia: { commissionBps: 1000 } });
    await o.svc.checkout({ user: { id: 'u1', email: 'u@x', name: 'U', roles: ['student'] }, ip: null }, { immediateAccessConsent: true, ...T });
    expect(o.created[0].lines.create[0]).toMatchObject({ commissionBps: 1000, payee: 'instructor', instructorShareCents: 4499, transferStatus: 'pending' });
    const d = build({ commissionBps: 2000, nadia: { payToPlatform: true } });
    await d.svc.checkout({ user: { id: 'u1', email: 'u@x', name: 'U', roles: ['student'] }, ip: null }, { immediateAccessConsent: true, ...T });
    expect(d.created[0].lines.create[0]).toMatchObject({ commissionBps: 2000, payee: 'del_agreement', instructorShareCents: 3999, transferStatus: 'none' });
    expect(d.created[0].lines.create[1]).toMatchObject({ payee: 'platform', instructorShareCents: 0, transferStatus: 'none' });
  });

  it('paid checkout needs the immediate-access consent (EU/UK digital content)', async () => {
    const { svc } = build({ commissionBps: 2000 });
    await expect(svc.checkout({ user: { id: 'u1', email: 'u@x', name: 'U', roles: ['student'] }, ip: null }, T)).rejects.toMatchObject({ code: 'consent_required' });
  });

  it('every order needs the current terms accepted, and records version, time and IP', async () => {
    const { svc, created } = build({ commissionBps: 2000 });
    const actor = { user: { id: 'u1', email: 'u@x', name: 'U', roles: ['student'] }, ip: '203.0.113.7' } as any;
    await expect(svc.checkout(actor, { immediateAccessConsent: true })).rejects.toMatchObject({ code: 'terms_required' });
    await expect(svc.checkout(actor, { immediateAccessConsent: true, acceptTerms: false, termsVersion: TERMS_VERSION })).rejects.toMatchObject({ code: 'terms_required' });
    await expect(svc.checkout(actor, { immediateAccessConsent: true, acceptTerms: true, termsVersion: '2020-01-01' })).rejects.toMatchObject({ code: 'terms_outdated' });
    expect(created).toHaveLength(0);
    await svc.checkout(actor, { immediateAccessConsent: true, ...T });
    expect(created[0]).toMatchObject({ termsVersion: TERMS_VERSION, termsAcceptedAt: expect.any(Date), termsAcceptedIp: '203.0.113.7' });
  });

  it('refuses to take payment when neither Stripe nor dev test payments are available', async () => {
    const { svc } = build({ commissionBps: 0, devPayments: false });
    await expect(svc.checkout({ user: { id: 'u1', email: 'u@x', name: 'U', roles: ['student'] }, ip: null }, { immediateAccessConsent: true, ...T })).rejects.toMatchObject({ code: 'payments_unavailable' });
  });

  it('dev test payments are never enabled in production, even when the flag is on', () => {
    process.env.DEV_TEST_PAYMENTS = 'true';
    process.env.NODE_ENV = 'production';
    resetEnvCache();
    expect(devPaymentsEnabled()).toBe(false);
    process.env.NODE_ENV = 'test';
    resetEnvCache();
    expect(devPaymentsEnabled()).toBe(true);
  });

  afterAll(() => {
    process.env.DEV_TEST_PAYMENTS = 'true';
    process.env.NODE_ENV = 'test';
    resetEnvCache();
  });
});
