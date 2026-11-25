import { ActivePromotion, currentPrice, PriceInput, promotionApplies, promotionPriceCents } from './sale-pricing';

const course = (o: Partial<PriceInput> = {}): PriceInput => ({ id: 'c1', priceCents: 5000, categoryId: 'cat1', promoOptOut: false, platformOwned: false, ...o });
const ends = new Date('2030-01-01T00:00:00Z');
const promo = (o: Partial<ActivePromotion> = {}): ActivePromotion => ({ id: 'p1', name: 'Spring sale', percentOff: 30, endsAt: ends, scope: 'all', categoryIds: [], courseIds: [], ...o });
const sale = (cents: number) => ({ id: 's1', courseId: 'c1', salePriceCents: cents, endsAt: ends });

describe('sale pricing', () => {
  it('no sale: the regular price', () => {
    expect(currentPrice(course(), undefined, [])).toEqual({ listPriceCents: 5000, priceCents: 5000, sale: null });
  });

  it("an instructor's sale sets the price and its percent off", () => {
    const p = currentPrice(course(), sale(2999), []);
    expect(p.priceCents).toBe(2999);
    expect(p.sale).toMatchObject({ kind: 'course_sale', id: 's1', percentOff: 40 });
  });

  it('a promotion takes its percentage off, rounded to the cent', () => {
    expect(currentPrice(course({ priceCents: 4999 }), undefined, [promo()]).priceCents).toBe(3499);
  });

  it('never below the platform minimum price', () => {
    expect(promotionPriceCents(999, 90)).toBe(499);
    expect(currentPrice(course({ priceCents: 499 }), undefined, [promo({ percentOff: 50 })]).sale).toBeNull();
  });

  it('lowest price wins and discounts never stack', () => {
    expect(currentPrice(course(), sale(4000), [promo({ percentOff: 30 })])).toMatchObject({ priceCents: 3500, sale: { kind: 'promotion' } });
    expect(currentPrice(course(), sale(2000), [promo({ percentOff: 30 })])).toMatchObject({ priceCents: 2000, sale: { kind: 'course_sale' } });
    expect(currentPrice(course(), undefined, [promo({ id: 'a', percentOff: 10 }), promo({ id: 'b', percentOff: 25 })])).toMatchObject({ priceCents: 3750, sale: { id: 'b' } });
  });

  it('a tie goes to the instructor sale', () => {
    expect(currentPrice(course(), sale(3500), [promo({ percentOff: 30 })]).sale?.kind).toBe('course_sale');
  });

  it('free courses are never discounted', () => {
    expect(currentPrice(course({ priceCents: 0 }), sale(0), [promo()]).sale).toBeNull();
  });

  it('a sale price at or above the regular price is ignored (e.g. after a price cut)', () => {
    expect(currentPrice(course({ priceCents: 2500 }), sale(2999), []).sale).toBeNull();
  });

  it('opted-out courses skip promotions, except DEL courses', () => {
    expect(promotionApplies(promo(), course({ promoOptOut: true }))).toBe(false);
    expect(promotionApplies(promo(), course({ promoOptOut: true, platformOwned: true }))).toBe(true);
  });

  it('scope: categories and picked courses', () => {
    expect(promotionApplies(promo({ scope: 'categories', categoryIds: ['cat1'] }), course())).toBe(true);
    expect(promotionApplies(promo({ scope: 'categories', categoryIds: ['cat2'] }), course())).toBe(false);
    expect(promotionApplies(promo({ scope: 'categories', categoryIds: ['cat1'] }), course({ categoryId: null }))).toBe(false);
    expect(promotionApplies(promo({ scope: 'courses', courseIds: ['c1'] }), course())).toBe(true);
    expect(promotionApplies(promo({ scope: 'courses', courseIds: ['c2'] }), course())).toBe(false);
  });
});
