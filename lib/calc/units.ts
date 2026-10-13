/**
 * Deterministic unit / package-size comparison.
 *
 * Unit conversion is ONLY allowed when package quantities and units are known and
 * compatible. 1 L <-> 1000 mL is valid. An unknown bottle size compared with 1 L is
 * NOT. When a valid comparison cannot be made we say so instead of guessing.
 */

export type Dimension = 'mass' | 'volume' | 'count';

export interface ParsedSize {
  /** numeric quantity within the package, e.g. 1 for "1 Liter" */
  quantity: number;
  /** the unit token found, canonicalised, e.g. "liter", "kg" */
  unit: string;
  dimension: Dimension;
  /** quantity expressed in the dimension base unit (g, ml, or count) */
  baseQuantity: number;
}

const MASS: Record<string, number> = { g: 1, gram: 1, grams: 1, kg: 1000, kilogram: 1000, kilograms: 1000 };
const VOLUME: Record<string, number> = { ml: 1, milliliter: 1, millilitre: 1, l: 1000, liter: 1000, litre: 1000, liters: 1000, litres: 1000 };
const COUNT_UNITS = new Set(['piece', 'bottle', 'pack', 'box', 'bag', 'tin', 'can', 'unit', 'pcs', 'pc']);

function canonicalVolume(token: string): string | null {
  const t = token.toLowerCase().replace(/\./g, '');
  return VOLUME[t] !== undefined ? t : null;
}

/** Parse a free-text package size such as "1 Liter", "5 kg", "1000 mL", "12 pcs". */
export function parsePackageSize(packageSize?: string, unitHint?: string): ParsedSize | null {
  const text = `${packageSize ?? ''} ${unitHint ?? ''}`.trim().toLowerCase();
  if (!text) return null;

  const m = text.match(/(\d+(?:[.,]\d+)?)\s*([a-z]+)/i);
  if (!m) return null;

  const quantity = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const token = m[2].toLowerCase();

  if (MASS[token] !== undefined) {
    return { quantity, unit: token === 'kg' || token === 'kilogram' || token === 'kilograms' ? 'kg' : 'g', dimension: 'mass', baseQuantity: quantity * MASS[token] };
  }
  const vol = canonicalVolume(token);
  if (vol !== null) {
    const isLiter = VOLUME[vol] === 1000;
    return { quantity, unit: isLiter ? 'liter' : 'ml', dimension: 'volume', baseQuantity: quantity * VOLUME[vol] };
  }
  if (COUNT_UNITS.has(token)) {
    return { quantity, unit: token, dimension: 'count', baseQuantity: quantity };
  }
  return null;
}

export interface ComparabilityResult {
  comparable: boolean;
  reason: string;
  dimension?: Dimension;
  baseUnit?: 'g' | 'ml' | 'count';
}

/**
 * Decide whether two supplier products can be compared on price.
 * Same-dimension + known quantities => comparable. Otherwise explain why not.
 */
export function checkComparability(
  a: { unit: string; packageSize?: string },
  b: { unit: string; packageSize?: string }
): ComparabilityResult {
  const pa = parsePackageSize(a.packageSize, a.unit);
  const pb = parsePackageSize(b.packageSize, b.unit);

  if (pa && pb) {
    if (pa.dimension !== pb.dimension) {
      return { comparable: false, reason: `Different measurement types (${pa.dimension} vs ${pb.dimension}).` };
    }
    return {
      comparable: true,
      reason: 'Comparable package sizes and units.',
      dimension: pa.dimension,
      baseUnit: pa.dimension === 'mass' ? 'g' : pa.dimension === 'volume' ? 'ml' : 'count',
    };
  }

  // Fall back: two identical unit strings are comparable ONLY when both package
  // sizes are unknown, or both are known and equal. An unknown size compared
  // against a known size is NOT comparable.
  if (a.unit && b.unit && a.unit.toLowerCase() === b.unit.toLowerCase()) {
    const aKnown = !!a.packageSize;
    const bKnown = !!b.packageSize;
    if (!aKnown && !bKnown) {
      return { comparable: true, reason: 'Same unit; assuming equivalent package size.', dimension: 'count', baseUnit: 'count' };
    }
    if (aKnown && bKnown && a.packageSize!.toLowerCase() === b.packageSize!.toLowerCase()) {
      return { comparable: true, reason: 'Same unit and package size.', dimension: 'count', baseUnit: 'count' };
    }
    return { comparable: false, reason: 'Same unit but package size is unknown or differs; prices are not directly comparable.' };
  }

  return { comparable: false, reason: 'Package size or unit is unknown; prices are not directly comparable.' };
}

/** Price per base unit (g/ml/count) for a given total price. */
export function pricePerBaseUnit(price: number, packageSize: string | undefined, unit: string): number | null {
  const parsed = parsePackageSize(packageSize, unit);
  if (!parsed || parsed.baseQuantity <= 0) return null;
  return price / parsed.baseQuantity;
}
