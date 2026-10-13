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
