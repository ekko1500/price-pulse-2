import { describe, it, expect } from 'vitest';
import {
  computeSellingFrequency,
  classifyVelocity,
  recommendPriceByVelocity,
  priceForTargetMargin,
  type SaleLineLike,
} from '@/lib/calc/pricing';

const NOW = new Date('2026-03-01T00:00:00Z');

const SALES: SaleLineLike[] = [
  { soldAt: '2026-02-20T10:00:00Z', status: 'completed', items: [{ productId: 'a', quantity: 3, unitPrice: 100 }] },
  {
    soldAt: '2026-02-25T10:00:00Z',
    status: 'completed',
    items: [
      { productId: 'a', quantity: 2, unitPrice: 200 },
      { productId: 'b', quantity: 5, unitPrice: 50 },
    ],
  },
  { soldAt: '2026-02-26T10:00:00Z', status: 'voided', items: [{ productId: 'a', quantity: 10, unitPrice: 100 }] },
  { soldAt: '2025-12-01T10:00:00Z', status: 'completed', items: [{ productId: 'a', quantity: 99, unitPrice: 100 }] },
];

describe('computeSellingFrequency', () => {
  it('counts only in-window, non-voided lines for the item', () => {
    const f = computeSellingFrequency(SALES, 'a', 30, NOW);
    expect(f.unitsSold).toBe(5); // 3 + 2 (voided + out-of-window excluded)
    expect(f.saleCount).toBe(2);
    expect(f.avgUnitPrice).toBe(140); // (300 + 400) / 5
    expect(f.avgDailyUnits).toBe(0.17); // 5 / 30
    expect(f.lastSoldAt).toBe('2026-02-25T10:00:00Z');
  });

  it('returns a zeroed frequency when the item never sold', () => {
    const f = computeSellingFrequency(SALES, 'missing', 30, NOW);
    expect(f.unitsSold).toBe(0);
    expect(f.avgUnitPrice).toBe(0);
    expect(f.lastSoldAt).toBeUndefined();
  });
});

describe('classifyVelocity', () => {
  it('maps frequency to a tier', () => {
    expect(classifyVelocity(computeSellingFrequency([], 'a', 30, NOW))).toBe('none');
    expect(classifyVelocity({ windowDays: 30, unitsSold: 30, saleCount: 5, avgDailyUnits: 1, avgUnitPrice: 0 })).toBe('fast');
    expect(classifyVelocity({ windowDays: 30, unitsSold: 6, saleCount: 2, avgDailyUnits: 0.2, avgUnitPrice: 0 })).toBe('steady');
    expect(classifyVelocity({ windowDays: 30, unitsSold: 1, saleCount: 1, avgDailyUnits: 0.03, avgUnitPrice: 0 })).toBe('slow');
  });
});

describe('recommendPriceByVelocity', () => {
  const freq = (avgDailyUnits: number, unitsSold: number) => ({
    windowDays: 30,
    unitsSold,
    saleCount: unitsSold,
    avgDailyUnits,
    avgUnitPrice: 0,
  });

  it('recommends a higher margin for fast movers and lower for slow/none', () => {
    const fast = recommendPriceByVelocity({ wholesaleCost: 5000, currentPrice: 5000, frequency: freq(1, 30) });
    expect(fast.velocityTier).toBe('fast');
    expect(fast.targetMarginPercentage).toBe(20);
    expect(fast.recommendedPrice).toBe(6300); // 5000 / 0.8 = 6250 -> 6300

    const none = recommendPriceByVelocity({ wholesaleCost: 5000, currentPrice: 5000, frequency: freq(0, 0) });
    expect(none.velocityTier).toBe('none');
    expect(none.targetMarginPercentage).toBe(10);
    expect(none.recommendedPrice).toBe(5600); // 5000 / 0.9 = 5555.6 -> 5600

    const slow = recommendPriceByVelocity({ wholesaleCost: 5000, currentPrice: 5000, frequency: freq(0.03, 1) });
    expect(slow.targetMarginPercentage).toBe(12);
    expect(slow.recommendedPrice).toBe(5700); // 5000 / 0.88 = 5681.8 -> 5700
  });

  it('nudges the target for stock position', () => {
    const overstocked = recommendPriceByVelocity({
      wholesaleCost: 5000,
      currentPrice: 5000,
      frequency: freq(0.03, 1),
      currentStock: 100,
      lowStockThreshold: 10,
    });
    expect(overstocked.targetMarginPercentage).toBe(9); // 15 - 3 (slow) - 3 (overstocked)
    expect(overstocked.recommendedPrice).toBe(5500);

    const scarce = recommendPriceByVelocity({
      wholesaleCost: 5000,
      currentPrice: 5000,
      frequency: freq(1, 30),
      currentStock: 5,
      lowStockThreshold: 10,
    });
    expect(scarce.targetMarginPercentage).toBe(22); // 15 + 5 (fast) + 2 (scarce)
    expect(scarce.recommendedPrice).toBe(6500);
  });

  it('reports the margin at the current price and the suggested delta', () => {
    const r = recommendPriceByVelocity({ wholesaleCost: 5000, currentPrice: 5600, frequency: freq(1, 30) });
    expect(r.currentMarginPercentage).toBe(10.7);
    expect(r.suggestedDeltaMMK).toBe(700); // 6300 - 5600
    expect(r.isValid).toBe(true);
  });

  it('is invalid when cost is zero (nothing to recommend)', () => {
    const r = recommendPriceByVelocity({ wholesaleCost: 0, currentPrice: 0, frequency: freq(1, 30) });
    expect(r.isValid).toBe(false);
    expect(r.suggestedDeltaMMK).toBe(0);
  });
});

describe('priceForTargetMargin', () => {
  it('returns a rounded price for a target margin', () => {
    expect(priceForTargetMargin(5000, 20).roundedRecommendedPrice).toBe(6300);
    expect(priceForTargetMargin(5000, 0).isValid).toBe(true);
    expect(priceForTargetMargin(0, 20).isValid).toBe(false);
  });
});
