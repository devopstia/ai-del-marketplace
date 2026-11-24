import { devPaymentsEnabled, resetEnvCache } from '../config/env';
import { CommerceService } from './commerce.service';

describe('CommerceService.checkout (order lines + commission)', () => {
  const items = [
    { courseId: 'c-nadia', course: { id: 'c-nadia', title: 'n8n', priceCents: 4999, currency: 'usd', status: 'published', instructorId: 'i-nadia' } },
    { courseId: 'c-del', course: { id: 'c-del', title: 'CI/CD', priceCents: 6999, currency: 'usd', status: 'published', instructorId: 'i-del' } },
  ];

  function build(opts: { commissionBps: number; devPayments?: boolean; stripe?: boolean }) {
    process.env.DEV_TEST_PAYMENTS = String(opts.devPayments ?? true);
    resetEnvCache();
    const created: any[] = [];
    const prisma: any = {
      cartItem: { findMany: jest.fn(async () => items), deleteMany: jest.fn() },
      enrollment: { findMany: jest.fn(async () => []) },
      instructorProfile: { findMany: jest.fn(async () => [{ userId: 'i-del' }]) },
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
    );
    return { svc, created };
  }

  it('applies the platform commission to third-party lines and keeps 100% of platform courses', async () => {
    const { svc, created } = build({ commissionBps: 1500 });
    const r = await svc.checkout({ user: { id: 'u1', email: 'u@x', name: 'U', roles: ['student'] }, ip: null });
    expect(r.mode).toBe('test');
    expect(r.url).toMatch(/\/checkout\/test-payment\?order=o1$/);
    const [nadia, del] = created[0].lines.create;
    expect(created[0].totalCents).toBe(11998);
    expect(nadia).toMatchObject({ priceCents: 4999, commissionBps: 1500, instructorShareCents: 4249, transferStatus: 'pending' });
    expect(del).toMatchObject({ priceCents: 6999, commissionBps: 10000, instructorShareCents: 0, transferStatus: 'none' });
  });

  it('default commission 0: instructor share is the full price', async () => {
    const { svc, created } = build({ commissionBps: 0 });
    await svc.checkout({ user: { id: 'u1', email: 'u@x', name: 'U', roles: ['student'] }, ip: null });
    expect(created[0].lines.create[0]).toMatchObject({ instructorShareCents: 4999, commissionBps: 0 });
  });

  it('refuses to take payment when neither Stripe nor dev test payments are available', async () => {
    const { svc } = build({ commissionBps: 0, devPayments: false });
    await expect(svc.checkout({ user: { id: 'u1', email: 'u@x', name: 'U', roles: ['student'] }, ip: null })).rejects.toMatchObject({ code: 'payments_unavailable' });
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
