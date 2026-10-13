import { ExtractedPriceDraft } from '../types';
import { PRODUCT_UNITS } from '../types';
import { isValidISODate } from '../validation';

/**
 * Validates and coerces raw (untrusted) extraction output into a safe
 * ExtractedPriceDraft. AI output is treated as untrusted input: nothing here
 * trusts types, ranges, or presence of fields.
 */
export function validateExtractedDraft(raw: unknown, rawMessage: string): ExtractedPriceDraft {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const missingFields: string[] = [];
  const warnings: string[] = [];

  const productName =
    typeof obj.productName === 'string' && obj.productName.trim()
      ? obj.productName.trim()
      : '';
  if (!productName) missingFields.push('productName');

  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined;

  const brand = str(obj.brand);
  const packageSize = str(obj.packageSize);

  let unit = (str(obj.unit) ?? '').toLowerCase();
  if (!PRODUCT_UNITS.includes(unit as (typeof PRODUCT_UNITS)[number])) {
    // try a light normalisation
    const synonym: Record<string, string> = {
      bottles: 'bottle', packs: 'pack', boxes: 'box', bags: 'bag', tins: 'tin',
      cans: 'can', piece: 'piece', pcs: 'piece', pc: 'piece', grams: 'g',
      kilogram: 'kg', kilograms: 'kg', litre: 'liter', litres: 'liter', liters: 'liter',
      liter: 'liter', l: 'liter', ml: 'ml', g: 'g', kg: 'kg',
    };
    const mapped = synonym[unit];
    if (mapped) unit = mapped;
  }
  if (!unit || !PRODUCT_UNITS.includes(unit as (typeof PRODUCT_UNITS)[number])) {
    unit = '';
    missingFields.push('unit');
  }

  const toPositive = (v: unknown): number | undefined => {
    const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : v;
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
  };

  const newPrice = toPositive(obj.newPrice);
  if (newPrice === undefined) missingFields.push('newPrice');
  if (newPrice !== undefined && newPrice > 100_000_000) {
    warnings.push('The new price is unusually large; please double-check it.');
  }

  const previousPrice = toPositive(obj.previousPrice);
  if (previousPrice !== undefined && newPrice !== undefined && previousPrice === newPrice) {
    warnings.push('Previous and new price are identical.');
  }

  const effectiveDate = isValidISODate(obj.effectiveDate) ? obj.effectiveDate : undefined;

  let confidence = typeof obj.confidence === 'number' && Number.isFinite(obj.confidence) ? obj.confidence : 0.5;
  confidence = Math.max(0, Math.min(1, confidence));

  const candidateProductIds = Array.isArray(obj.candidateProductIds)
    ? (obj.candidateProductIds as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  const notes = str(obj.notes);

  return {
    productName,
    brand,
    packageSize,
    unit,
    previousPrice,
    // The caller MUST confirm before publication; 0 here signals "missing".
    newPrice: newPrice ?? 0,
    currency: 'MMK',
    effectiveDate,
    confidence,
    missingFields: Array.from(new Set(missingFields)),
    warnings,
    notes,
    rawMessage,
    candidateProductIds,
  };
}
