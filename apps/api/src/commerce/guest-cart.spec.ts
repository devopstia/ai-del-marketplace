import { CommerceService } from './commerce.service';

const noSales: any = { prices: async () => new Map(), pricesForIds: async () => new Map() };

const card = (id: string, priceCents: number, instructorId = 'teacher') => ({
  id, slug: id, title: `Course ${id}`, subtitle: '', thumbnailKey: null, priceCents, currency: 'usd', ratingAvg: 0, ratingCount: 0, studentCount: 0, level: 'beginner', language: 'en', publishedAt: null,
  instructorId, instructor: { id: instructorId, name: 'T' }, category: null, sections: [], status: 'published',
});

function build() {
  const published = [card('a', 2999), card('b', 0), card('mine', 4999, 'u1'), card('owned', 1999), card('incart', 999)];
  const cart: string[] = ['incart'];
  const prisma: any = {
    course: { findMany: jest.fn(async ({ where }: any) => published.filter((c) => where.id.in.includes(c.id))) },
    enrollment: { findMany: jest.fn(async () => [{ courseId: 'owned' }]) },
    cartItem: {
      findMany: jest.fn(async ({ where }: any) =>
        where.courseId ? cart.filter((c) => where.courseId.in.includes(c)).map((courseId) => ({ courseId })) : cart.map((courseId) => ({ courseId, createdAt: new Date(), course: published.find((p) => p.id === courseId) }))),
      createMany: jest.fn(async ({ data }: any) => data.forEach((d: any) => cart.push(d.courseId))),
    },
  };
  const svc = new CommerceService(prisma, {} as any, {} as any, {} as any, {} as any, { imageUrl: () => null } as any, noSales);
  return { svc, prisma, cart };
}

describe('guest cart', () => {
  it('preview returns card data in the given order, totals, and the ids that are not available; it never writes', async () => {
    const { svc, prisma } = build();
    const r = await svc.previewCart(['b', 'gone', 'a', 'a']);
    expect(r.items.map((i) => i.id)).toEqual(['b', 'a']);
    expect(r).toMatchObject({ count: 2, totalCents: 2999, currency: 'usd', unavailableIds: ['gone'] });
    expect(prisma.cartItem.createMany).not.toHaveBeenCalled();
  });

  it('merge adds only buyable courses and says why the others were skipped', async () => {
    const { svc, cart } = build();
    const r = await svc.mergeCart('u1', ['a', 'mine', 'owned', 'incart', 'gone', 'a']);
    expect(r.merge.added).toEqual(['a']);
    expect(r.merge.skipped).toEqual([
      { courseId: 'mine', reason: 'own_course' },
      { courseId: 'owned', reason: 'already_enrolled' },
      { courseId: 'incart', reason: 'already_in_cart' },
      { courseId: 'gone', reason: 'unavailable' },
    ]);
    expect(cart).toEqual(['incart', 'a']);
    expect(r.count).toBe(2);
  });
});
