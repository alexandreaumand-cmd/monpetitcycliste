/**
 * ROI (Return on Investment) calculation utilities
 * 
 * Formula: ROI = Σ points / Σ prix d'achat
 * Applied on the same perimeter (season OR phase)
 */

export type RiderAtom = {
  pointsTotal: number | null | undefined;
  purchasePriceTotal: number | null | undefined;
};

/**
 * Compute ROI for a single rider
 * @param atom - Rider data with total points and total purchase price
 * @param minDivisor - Minimum divisor to avoid division by zero (default: 1)
 * @returns ROI value (points / price)
 */
export function computeRiderROI(
  { pointsTotal, purchasePriceTotal }: RiderAtom,
  minDivisor = 1
): number {
  const pts = Number(pointsTotal ?? 0);
  const price = Number(purchasePriceTotal ?? 0);
  const denom = Math.max(minDivisor, Number.isFinite(price) ? price : 0);
  return pts / denom;
}

/**
 * Compute aggregate ROI for multiple riders (team)
 * Important: This is NOT the average of individual ROIs, but Σ points / Σ prices
 * @param items - Array of rider data
 * @param minDivisor - Minimum divisor to avoid division by zero (default: 1)
 * @returns Aggregate ROI value
 */
export function computeAggregateROI(items: RiderAtom[], minDivisor = 1): number {
  const pts = items.reduce((s, it) => s + Number(it.pointsTotal ?? 0), 0);
  const price = items.reduce((s, it) => s + Number(it.purchasePriceTotal ?? 0), 0);
  const denom = Math.max(minDivisor, Number.isFinite(price) ? price : 0);
  return pts / denom;
}

/**
 * Format ROI value for display
 * @param value - ROI value to format
 * @param unit - Unit to display (default: "pts/crédit")
 * @param digits - Number of decimal digits (default: 3)
 * @returns Formatted string
 */
export function formatROI(
  value: number,
  unit = "pts/crédit",
  digits = 3
): string {
  return `${value.toFixed(digits)} ${unit}`;
}

/**
 * Format ROI value without unit (for tables/compact display)
 * @param value - ROI value to format
 * @param digits - Number of decimal digits (default: 2)
 * @returns Formatted number string
 */
export function formatROICompact(value: number, digits = 2): string {
  return value.toFixed(digits);
}
