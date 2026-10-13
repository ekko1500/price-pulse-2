import { describe, it, expect } from 'vitest';
import { deterministicExtract, parsePrices, normalizeMyanmarDigits } from '@/lib/ai/extractor';
import { buildDemoData } from '@/lib/seed/demo';

const catalog = Object.values(buildDemoData().products).filter((p) => p.wholesalerId === 'biz-wholesaler-1');

describe('Myanmar digit normalisation', () => {
  it('converts Burmese digits to ASCII', () => {
    expect(normalizeMyanmarDigits('၅၈၀၀')).toBe('5800');
  });
});

describe('deterministic extraction (no AI)', () => {
  it('parses an English message with "was" giving new-then-old', () => {
    const d = deterministicExtract('Cooking Oil 1 Liter now 5800 MMK, was 5000', catalog);
    expect(d.newPrice).toBe(5800);
    expect(d.previousPrice).toBe(5000);
    expect(d.unit).toBe('bottle');
    expect(d.packageSize).toBe('1 liter');
    expect(d.candidateProductIds).toContain('prod-w1-oil');
  });

  it('never invents an effective date when none is provided', () => {
    const d = deterministicExtract('Cooking Oil 1 Liter now 5800 MMK', catalog);
    expect(d.effectiveDate).toBeUndefined();
    expect(d.warnings.join(' ')).toMatch(/effective date/i);
  });

  it('parses a Burmese message', () => {
    const d = deterministicExtract('ဆီ ၁ လီတာ ၅၈၀၀ ကျပ်', catalog);
    expect(d.newPrice).toBe(5800);
    expect(d.productName).toBeTruthy();
  });

  it('does not treat a package size as a price', () => {
    // The only bare numbers are inside "1 Liter"; there is no price.
    const d = deterministicExtract('Cooking Oil 1 Liter', catalog);
    expect(d.newPrice).toBe(0);
    expect(d.missingFields).toContain('newPrice');
  });

  it('flags an ambiguous two-price message instead of guessing silently', () => {
    const d = deterministicExtract('Cooking oil 5000 5800', catalog);
    expect(d.warnings.join(' ')).toMatch(/unclear|verify/i);
  });

  it('recognises "from ... to" ordering', () => {
    const p = parsePrices('price changed from 5000 to 5800');
    expect(p.previousPrice).toBe(5000);
    expect(p.newPrice).toBe(5800);
    expect(p.ambiguousOrder).toBe(false);
  });

  it('warns when the message has no catalog match', () => {
    const d = deterministicExtract('Sugar 1 kg now 3000', []);
    expect(d.warnings.join(' ')).toMatch(/no matching product|catalog/i);
  });
});
