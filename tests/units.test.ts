import { describe, it, expect } from 'vitest';
import { checkComparability, parsePackageSize, pricePerBaseUnit } from '@/lib/calc/units';

describe('package size parsing', () => {
  it('parses mass, volume and count', () => {
    expect(parsePackageSize('5 kg')?.dimension).toBe('mass');
    expect(parsePackageSize('1 Liter')?.dimension).toBe('volume');
    expect(parsePackageSize('12 pcs')?.dimension).toBe('count');
  });
  it('returns null for unparseable sizes instead of guessing', () => {
    expect(parsePackageSize('large')).toBeNull();
    expect(parsePackageSize(undefined, 'bottle')).toBeNull();
  });
});

describe('comparability', () => {
  it('treats 1 L and 1000 mL as comparable', () => {
    const r = checkComparability({ unit: 'bottle', packageSize: '1 Liter' }, { unit: 'bottle', packageSize: '1000 mL' });
    expect(r.comparable).toBe(true);
    expect(r.dimension).toBe('volume');
  });

  it('refuses to compare unknown bottle size against 1 L', () => {
    const r = checkComparability({ unit: 'bottle', packageSize: undefined }, { unit: 'bottle', packageSize: '1 Liter' });
    expect(r.comparable).toBe(false);
    expect(r.reason).toMatch(/unknown|not directly/i);
  });

  it('refuses to compare different dimensions', () => {
    const r = checkComparability({ unit: 'kg', packageSize: '1 kg' }, { unit: 'liter', packageSize: '1 Liter' });
    expect(r.comparable).toBe(false);
  });
});

describe('price per base unit', () => {
  it('normalises to base units for a fair comparison', () => {
    // 5,000 for 1 L vs 5,200 for 1 L
    expect(pricePerBaseUnit(5000, '1 Liter', 'bottle')).toBe(5);
    // 9,000 for 2 kg => 4.5 MMK/g
    expect(pricePerBaseUnit(9000, '2 kg', 'bag')).toBe(4.5);
  });
  it('returns null when size cannot be parsed', () => {
    expect(pricePerBaseUnit(5000, undefined, 'bottle')).toBeNull();
  });
});
