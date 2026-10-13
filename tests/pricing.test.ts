import { describe, it, expect } from 'vitest';
import {
  calculateGrossMargin,
  calculateRecommendedSellingPrice,
  calculatePriceImpact,
  roundUpToNext100MMK,
  formatMMK,
  percentageChange,
} from '@/lib/calc/pricing';

describe('gross margin calculation', () => {
  it('computes gross profit and margin% for a normal case', () => {
    const r = calculateGrossMargin(5600, 5000);
    expect(r.grossProfit).toBe(600);
    expect(r.grossMarginPercentage).toBe(10.7);
    expect(r.isNegativeMargin).toBe(false);
    expect(r.isValid).toBe(true);
  });

  it('flags negative margin without throwing', () => {
    const r = calculateGrossMargin(5600, 5800);
    expect(r.grossProfit).toBe(-200);
    expect(r.grossMarginPercentage).toBe(-3.6);
    expect(r.isNegativeMargin).toBe(true);
  });

  it('returns null margin when selling price is zero (cannot divide)', () => {
    const r = calculateGrossMargin(0, 5000);
    expect(r.grossMarginPercentage).toBeNull();
    expect(r.isValid).toBe(false);
  });

  it('rejects non-finite inputs', () => {
    expect(calculateGrossMargin(NaN, 1).isValid).toBe(false);
    // @ts-expect-error intentionally invalid (undefined is not a number)
    expect(calculateGrossMargin(undefined, 1).isValid).toBe(false);
  });
});

describe('recommended selling price', () => {
  it('applies cost / (1 - margin) and rounds UP to 100 MMK', () => {
    const r = calculateRecommendedSellingPrice(5800, 15);
    expect(r.exactRecommendedPrice).toBeCloseTo(6823.53, 2);
    expect(r.roundedRecommendedPrice).toBe(6900);
  });

  it('keeps a value that is already a multiple of 100 unchanged', () => {
    expect(roundUpToNext100MMK(5000)).toBe(5000);
    expect(roundUpToNext100MMK(5001)).toBe(5100);
  });

  it('defaults target margin to 15%', () => {
    const a = calculateRecommendedSellingPrice(1000);
    const b = calculateRecommendedSellingPrice(1000, 15);
    expect(a.roundedRecommendedPrice).toBe(b.roundedRecommendedPrice);
  });

  it('is invalid for a 100%+ target margin or non-positive cost', () => {
    expect(calculateRecommendedSellingPrice(1000, 100).isValid).toBe(false);
    expect(calculateRecommendedSellingPrice(0, 15).isValid).toBe(false);
  });
});

describe('Section 9 benchmark: cooking oil price change', () => {
  it('matches the published worked example exactly', () => {
    const impact = calculatePriceImpact(5000, 5800, 5600, 15);
    expect(impact.costDiffMMK).toBe(800);
    expect(impact.costChangePercentage).toBe(16);
    expect(impact.before.grossProfit).toBe(600);
    expect(impact.before.grossMarginPercentage).toBe(10.7);
    expect(impact.after.grossProfit).toBe(-200);
    expect(impact.after.grossMarginPercentage).toBe(-3.6);
    expect(impact.after.marginErosionPoints).toBe(-14.3);
    expect(impact.recommendedNewSellingPrice).toBe(6900);
  });
});

describe('formatting helpers', () => {
  it('formats MMK with thousands separators', () => {
    expect(formatMMK(18500)).toBe('18,500 MMK');
    expect(formatMMK(null)).toBe('0 MMK');
  });
  it('computes percentage change safely', () => {
    expect(percentageChange(5000, 5800)).toBe(16);
    expect(percentageChange(0, 5800)).toBe(0);
  });
});
