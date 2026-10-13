import { describe, it, expect } from 'vitest';
import { validateExtractedDraft } from '@/lib/ai/schema';

describe('validateExtractedDraft treats AI output as untrusted input', () => {
  it('accepts a well-formed object', () => {
    const d = validateExtractedDraft(
      { productName: 'Cooking Oil', unit: 'bottle', newPrice: 5800, effectiveDate: '2026-02-10', confidence: 0.9 },
      'raw'
    );
    expect(d.newPrice).toBe(5800);
    expect(d.unit).toBe('bottle');
    expect(d.missingFields).toHaveLength(0);
  });

  it('does not accept a script/HTML blob as a price or name', () => {
    const d = validateExtractedDraft({ productName: '<script>alert(1)</script>', newPrice: '1e999', unit: 'bottle' }, 'raw');
    expect(d.newPrice).toBe(0);
    expect(d.missingFields).toContain('newPrice');
  });

  it('rejects negative and non-numeric prices', () => {
    expect(validateExtractedDraft({ newPrice: -5 }, 'r').newPrice).toBe(0);
    expect(validateExtractedDraft({ newPrice: 'abc' }, 'r').newPrice).toBe(0);
  });

  it('normalises unit synonyms', () => {
    expect(validateExtractedDraft({ newPrice: 1, unit: 'litres' }, 'r').unit).toBe('liter');
    expect(validateExtractedDraft({ newPrice: 1, unit: 'nonsense' }, 'r').unit).toBe('');
  });

  it('drops malformed dates rather than inventing them', () => {
    expect(validateExtractedDraft({ newPrice: 1, effectiveDate: 'next week' }, 'r').effectiveDate).toBeUndefined();
    expect(validateExtractedDraft({ newPrice: 1, effectiveDate: '2026-13-40' }, 'r').effectiveDate).toBeUndefined();
  });

  it('clamps confidence into [0,1]', () => {
    expect(validateExtractedDraft({ newPrice: 1, confidence: 5 }, 'r').confidence).toBe(1);
    expect(validateExtractedDraft({ newPrice: 1, confidence: -3 }, 'r').confidence).toBe(0);
  });

  it('handles a completely non-object input', () => {
    const d = validateExtractedDraft(null, 'raw');
    expect(d.newPrice).toBe(0);
    expect(d.missingFields).toContain('productName');
  });
});
