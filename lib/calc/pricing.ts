/**
 * Exact, deterministic pricing and profit calculations for PricePulse Myanmar.
 * All arithmetic here is strictly non-AI and unit-tested.
 * Currency: MMK (Myanmar Kyat)
 *
 * NOTE: "gross" here is gross profit/margin before operating expenses, taxes and
 * other costs. It is NOT net profit.
 */

export interface MarginCalculationResult {
  sellingPrice: number;
  wholesaleCost: number;
  grossProfit: number;
  /** null when selling price is <= 0 or invalid (margin cannot be computed) */
  grossMarginPercentage: number | null;
  isNegativeMargin: boolean;
  isValid: boolean;
}

export interface RecommendedPriceResult {
  wholesaleCost: number;
  targetMarginPercentage: number;
  exactRecommendedPrice: number;
  /** rounded UP to the next 100 MMK */
  roundedRecommendedPrice: number;
  priceDiffFromCurrent: number | null;
  isValid: boolean;
}

export interface PriceImpactComparison {
  oldWholesaleCost: number;
  newWholesaleCost: number;
  costDiffMMK: number;
  costChangePercentage: number;
  currentSellingPrice: number;
  before: {
    grossProfit: number;
    grossMarginPercentage: number | null;
  };
  after: {
    grossProfit: number;
    grossMarginPercentage: number | null;
    /** e.g. 10.7% -> -3.6% is -14.3 points */
    marginErosionPoints: number | null;
  };
  recommendedNewSellingPrice: number;
  targetMarginPercentage: number;
}

function isValidNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * Gross profit per unit = selling price - wholesale purchase cost
 * Gross margin % = ((selling price - wholesale purchase cost) / selling price) * 100
 */
export function calculateGrossMargin(
  sellingPrice: number,
  wholesaleCost: number
): MarginCalculationResult {
  if (!isValidNumber(sellingPrice) || !isValidNumber(wholesaleCost)) {
    return {
      sellingPrice: 0,
      wholesaleCost: 0,
      grossProfit: 0,
      grossMarginPercentage: null,
      isNegativeMargin: false,
      isValid: false,
    };
  }

  const grossProfit = sellingPrice - wholesaleCost;

  if (sellingPrice <= 0) {
    return {
      sellingPrice,
      wholesaleCost,
      grossProfit,
      grossMarginPercentage: null,
      isNegativeMargin: grossProfit < 0,
      isValid: false,
    };
  }

  const grossMarginPercentage = Math.round((grossProfit / sellingPrice) * 1000) / 10;

  return {
    sellingPrice,
    wholesaleCost,
    grossProfit,
    grossMarginPercentage,
    isNegativeMargin: grossProfit < 0,
    isValid: true,
  };
}

/**
 * Round UP to the next 100 MMK.
 * If already a multiple of 100 MMK, keeps it unchanged.
 */
export function roundUpToNext100MMK(value: number): number {
  if (!isValidNumber(value) || value <= 0) return 0;
  return Math.ceil(value / 100) * 100;
}

/**
 * Recommended retail selling price for a target gross margin.
 * Formula: wholesale purchase cost / (1 - target margin as a decimal)
 * Default target gross margin: 15%.
 */
export function calculateRecommendedSellingPrice(
  wholesaleCost: number,
  targetMarginPercentage: number = 15,
  currentSellingPrice?: number
): RecommendedPriceResult {
  if (
    !isValidNumber(wholesaleCost) ||
    wholesaleCost <= 0 ||
    !isValidNumber(targetMarginPercentage) ||
    targetMarginPercentage >= 100 ||
    targetMarginPercentage < 0
  ) {
    return {
      wholesaleCost,
      targetMarginPercentage,
      exactRecommendedPrice: 0,
      roundedRecommendedPrice: 0,
      priceDiffFromCurrent: null,
      isValid: false,
    };
  }

  const exact = wholesaleCost / (1 - targetMarginPercentage / 100);
  const rounded = roundUpToNext100MMK(exact);
  const priceDiffFromCurrent =
    isValidNumber(currentSellingPrice) && currentSellingPrice > 0
      ? rounded - currentSellingPrice
      : null;

  return {
    wholesaleCost,
    targetMarginPercentage,
    exactRecommendedPrice: exact,
    roundedRecommendedPrice: rounded,
    priceDiffFromCurrent,
    isValid: true,
  };
}

/**
 * Comprehensive impact of a wholesale price change on a retailer's margin.
 * Section 9 benchmark:
 *   old 5,000 / new 5,800 / retail 5,600
 *   before: +600 MMK, 10.7% | after: -200 MMK, -3.6%
 *   recommended @15%: 5,800 / 0.85 = 6,823.53 -> 6,900 MMK
 */
export function calculatePriceImpact(
  oldWholesaleCost: number,
  newWholesaleCost: number,
  currentSellingPrice: number,
  targetMarginPercentage: number = 15
): PriceImpactComparison {
  const costDiffMMK = newWholesaleCost - oldWholesaleCost;
  const costChangePercentage =
    oldWholesaleCost > 0
      ? Math.round(((newWholesaleCost - oldWholesaleCost) / oldWholesaleCost) * 1000) / 10
      : 0;

  const beforeCalc = calculateGrossMargin(currentSellingPrice, oldWholesaleCost);
  const afterCalc = calculateGrossMargin(currentSellingPrice, newWholesaleCost);

  const marginErosionPoints =
    beforeCalc.grossMarginPercentage !== null && afterCalc.grossMarginPercentage !== null
      ? Math.round((afterCalc.grossMarginPercentage - beforeCalc.grossMarginPercentage) * 10) / 10
      : null;

  const rec = calculateRecommendedSellingPrice(
    newWholesaleCost,
    targetMarginPercentage,
    currentSellingPrice
  );

  return {
    oldWholesaleCost,
    newWholesaleCost,
    costDiffMMK,
    costChangePercentage,
    currentSellingPrice,
    before: {
      grossProfit: beforeCalc.grossProfit,
      grossMarginPercentage: beforeCalc.grossMarginPercentage,
    },
    after: {
      grossProfit: afterCalc.grossProfit,
      grossMarginPercentage: afterCalc.grossMarginPercentage,
      marginErosionPoints,
    },
    recommendedNewSellingPrice: rec.roundedRecommendedPrice,
    targetMarginPercentage,
  };
}

/** Format MMK currency with thousands separators (e.g. 5,800 MMK). */
export function formatMMK(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '0 MMK';
  return `${amount.toLocaleString('en-US')} MMK`;
}

/** Percentage-point change between two wholesale prices. */
export function percentageChange(oldPrice: number, newPrice: number): number {
  if (!isValidNumber(oldPrice) || oldPrice <= 0) return 0;
  return Math.round(((newPrice - oldPrice) / oldPrice) * 1000) / 10;
}

/* -------------------------------------------------------------------------- */
/* Retailer selling-price advisor                                             */
/*                                                                            */
/* Wholesalers may offer the same price, but each retailer has different       */
/* transport/overhead costs — so the RETAILER sets the final price. These     */
/* helpers recommend a price from how fast the item actually sells, and let    */
/* the retailer see the gross margin at any price they choose.                 */
/* -------------------------------------------------------------------------- */

/** Minimal shape of a sale line needed to measure selling frequency. */
export interface SaleLineLike {
  soldAt: string;
  status: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
}

export interface SellingFrequency {
  windowDays: number;
  unitsSold: number;
  saleCount: number;
  /** average units sold per day over the window */
  avgDailyUnits: number;
  /** weighted average price the item actually sold at */
  avgUnitPrice: number;
  lastSoldAt?: string;
}

export type VelocityTier = 'fast' | 'steady' | 'slow' | 'none';

export interface VelocityPriceRecommendation {
  frequency: SellingFrequency;
  velocityTier: VelocityTier;
  /** target gross margin % used for the recommendation */
  targetMarginPercentage: number;
  exactPrice: number;
  recommendedPrice: number;
  currentPrice: number;
  currentMarginPercentage: number | null;
  suggestedDeltaMMK: number;
  rationale: string;
  isValid: boolean;
}

const BASE_TARGET_MARGIN = 15;
const MIN_TARGET_MARGIN = 5;
const MAX_TARGET_MARGIN = 40;
/** Margin nudge by how fast the item moves. */
const VELOCITY_MARGIN_ADJUSTMENT: Record<VelocityTier, number> = {
  fast: 5,
  steady: 2,
  slow: -3,
  none: -5,
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Measure how frequently an inventory item sells over a window. Voided sales are
 * ignored; only lines for the given inventory item count.
 */
export function computeSellingFrequency(
  sales: SaleLineLike[],
  inventoryItemId: string,
  windowDays = 30,
  now: Date = new Date()
): SellingFrequency {
  const window = windowDays > 0 ? windowDays : 30;
  const cutoff = now.getTime() - window * 86_400_000;
  let unitsSold = 0;
  let saleCount = 0;
  let revenue = 0;
  let lastSoldAt: string | undefined;

  for (const sale of sales) {
    if (sale.status === 'voided') continue;
    const t = new Date(sale.soldAt).getTime();
    if (!Number.isFinite(t) || t < cutoff) continue;
    for (const item of sale.items) {
      if (item.productId !== inventoryItemId) continue;
      const qty = isValidNumber(item.quantity) && item.quantity > 0 ? item.quantity : 0;
      if (qty === 0) continue;
      unitsSold += qty;
      revenue += qty * (isValidNumber(item.unitPrice) ? item.unitPrice : 0);
      saleCount += 1;
      if (!lastSoldAt || sale.soldAt > lastSoldAt) lastSoldAt = sale.soldAt;
    }
  }

  return {
    windowDays: window,
    unitsSold,
    saleCount,
    avgDailyUnits: Math.round((unitsSold / window) * 100) / 100,
    avgUnitPrice: unitsSold > 0 ? Math.round(revenue / unitsSold) : 0,
    lastSoldAt,
  };
}

/** Classify selling velocity into a simple tier. */
export function classifyVelocity(frequency: SellingFrequency): VelocityTier {
  if (frequency.unitsSold <= 0) return 'none';
  if (frequency.avgDailyUnits >= 0.5) return 'fast';
  if (frequency.avgDailyUnits >= 0.15) return 'steady';
  return 'slow';
}

function stockAdjustment(tier: VelocityTier, currentStock?: number, lowStockThreshold?: number): number {
  if (!isValidNumber(currentStock) || !isValidNumber(lowStockThreshold) || lowStockThreshold <= 0) return 0;
  if (tier === 'slow' && currentStock > lowStockThreshold * 3) return -3; // overstocked: clear it
  if (tier === 'fast' && currentStock <= lowStockThreshold) return 2; // scarce but in demand
  return 0;
}

function buildRationale(tier: VelocityTier, frequency: SellingFrequency, stockNudge: number): string {
  const window = frequency.windowDays;
  if (tier === 'none') {
    return `No sales in the last ${window} days — priced to attract buyers. You decide the final price.`;
  }
  const perDay = frequency.avgDailyUnits;
  const base =
    tier === 'fast'
      ? `Fast mover (${perDay}/day over ${window} days) — a higher margin should hold.`
      : tier === 'steady'
        ? `Steady seller (${perDay}/day over ${window} days) — a modest margin increase is safe.`
        : `Slow mover (${perDay}/day over ${window} days) — a lower margin helps turnover.`;
  const stock =
    stockNudge < 0
      ? ' Overstocked, so the target was eased further.'
      : stockNudge > 0
        ? ' Low stock but in demand, so the target was nudged up.'
        : '';
  return `${base}${stock} You decide the final price.`;
}

/**
 * Recommend a selling price from selling frequency (and a small stock nudge).
 * The recommendation is advisory only — the retailer always sets the final price.
 */
export function recommendPriceByVelocity(input: {
  wholesaleCost: number;
  currentPrice: number;
  frequency: SellingFrequency;
  currentStock?: number;
  lowStockThreshold?: number;
}): VelocityPriceRecommendation {
  const { wholesaleCost, currentPrice, frequency } = input;
  const tier = classifyVelocity(frequency);
  const stockNudge = stockAdjustment(tier, input.currentStock, input.lowStockThreshold);
  const targetMarginPercentage = clamp(
    BASE_TARGET_MARGIN + VELOCITY_MARGIN_ADJUSTMENT[tier] + stockNudge,
    MIN_TARGET_MARGIN,
    MAX_TARGET_MARGIN
  );

  const rec = calculateRecommendedSellingPrice(wholesaleCost, targetMarginPercentage, currentPrice);
  const currentMarginPercentage = calculateGrossMargin(currentPrice, wholesaleCost).grossMarginPercentage;

  return {
    frequency,
    velocityTier: tier,
    targetMarginPercentage,
    exactPrice: rec.exactRecommendedPrice,
    recommendedPrice: rec.roundedRecommendedPrice,
    currentPrice,
    currentMarginPercentage,
    suggestedDeltaMMK: rec.isValid ? rec.roundedRecommendedPrice - currentPrice : 0,
    rationale: buildRationale(tier, frequency, stockNudge),
    isValid: rec.isValid,
  };
}

/**
 * Margin calculator: given a cost and a price, return the gross margin %; and
 * given a cost and a target margin %, return the suggested price. The retailer
 * uses this to see the profit margin at whatever price they choose.
 */
export function priceForTargetMargin(wholesaleCost: number, targetMarginPercentage: number): RecommendedPriceResult {
  return calculateRecommendedSellingPrice(wholesaleCost, targetMarginPercentage);
}
