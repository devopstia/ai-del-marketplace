import { allocateFee, simulatedStripeFee, splitLine, splitOrder, refundDeadline, transferDueAt } from './money';

describe('marketplace money rules', () => {
  it("owner's example: $100, $3 fee → $97 → instructor $77.60, platform $19.40", () => {
    expect(splitLine(10000, 300, 2000)).toEqual({ feeCents: 300, netCents: 9700, instructorShareCents: 7760, platformCents: 1940 });
  });

  it('real Stripe fee on $100 (2.9% + 30¢ = $3.20) → $77.44 / $19.36', () => {
    expect(simulatedStripeFee(10000)).toBe(320);
    expect(splitLine(10000, 320, 2000)).toMatchObject({ netCents: 9680, instructorShareCents: 7744, platformCents: 1936 });
  });

  it('two-instructor cart shares one fee, parts add up exactly', () => {
    const [a, b] = splitOrder(465, [{ baseCents: 10000, platformBps: 2000 }, { baseCents: 5000, platformBps: 2000 }]);
    expect(a).toMatchObject({ feeCents: 310, netCents: 9690, instructorShareCents: 7752, platformCents: 1938 });
    expect(b).toMatchObject({ feeCents: 155, netCents: 4845, instructorShareCents: 3876, platformCents: 969 });
    expect(a!.platformCents + b!.platformCents).toBe(15000 - 465 - 7752 - 3876);
  });

  it("DEL's own course: everything to the platform", () => {
    expect(splitLine(8999, 291, 10000)).toEqual({ feeCents: 291, netCents: 8708, instructorShareCents: 0, platformCents: 8708 });
  });

  it('per-instructor override (e.g. 90/10)', () => {
    expect(splitLine(10000, 320, 1000)).toMatchObject({ instructorShareCents: 8712, platformCents: 968 });
  });

  it('rounds half up and never loses a cent', () => {
    // net 4999 × 80% = 3999.2 → 3999; net 4995 × 70% = 3496.5 → 3497
    expect(splitLine(5299, 300, 2000).instructorShareCents).toBe(3999);
    expect(splitLine(5295, 300, 3000).instructorShareCents).toBe(3497);
    for (let base = 499; base < 3000; base += 7) {
      const s = splitLine(base, Math.min(base, simulatedStripeFee(base)), 2000);
      expect(s.instructorShareCents + s.platformCents + s.feeCents).toBe(base);
    }
  });

  it('fee allocation is exact for awkward amounts and handles free lines', () => {
    const parts = allocateFee(100, [333, 333, 334]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(allocateFee(50, [0, 1000])).toEqual([0, 50]);
    expect(allocateFee(0, [1000, 500])).toEqual([0, 0]);
    expect(allocateFee(10, [0, 0])).toEqual([0, 0]);
    expect(() => allocateFee(2000, [1000])).toThrow();
  });

  it('free orders have no fee; hold and refund dates', () => {
    expect(simulatedStripeFee(0)).toBe(0);
    const paid = new Date('2026-11-01T10:00:00Z');
    expect(refundDeadline(paid, 14).toISOString()).toBe('2026-11-15T10:00:00.000Z');
    expect(transferDueAt(paid, 14).toISOString()).toBe('2026-11-17T10:00:00.000Z');
  });
});
