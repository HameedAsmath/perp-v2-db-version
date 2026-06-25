/** Max distance of a limit price from the market reference (bps). 2000 = ±20%. */
export const DEFAULT_MAX_PRICE_DEVIATION_BPS = 2000;

/** Fallback mark prices when no live feed is configured. */
export const DEFAULT_MARK_PRICES: Record<string, number> = {
  "BTC-PERP": 1000,
};

export function getDefaultMarkPrice(symbol: string): number {
  return DEFAULT_MARK_PRICES[symbol] ?? 0;
}

const STEP_EPSILON = 1e-8;

export function isMultipleOfStep(value: number, step: number): boolean {
  if (step <= 0) return false;
  const ratio = value / step;
  return Math.abs(ratio - Math.round(ratio)) < STEP_EPSILON;
}

export function alignToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

export function validateTickSize(
  price: number,
  tickSize: number,
): string | null {
  if (tickSize <= 0) return null;
  if (!isMultipleOfStep(price, tickSize)) {
    return `price must be a multiple of tick size ${tickSize}`;
  }
  return null;
}

export function validateQuantityStep(
  quantity: number,
  stepSize: number,
  minOrderSize: number,
  maxOrderSize: number,
): string | null {
  if (quantity < minOrderSize || quantity > maxOrderSize) {
    return `quantity must be between ${minOrderSize} and ${maxOrderSize}`;
  }
  if (stepSize > 0 && !isMultipleOfStep(quantity, stepSize)) {
    return `quantity must be a multiple of ${stepSize}`;
  }
  return null;
}

export function validatePriceBand(
  limitPrice: number,
  referencePrice: number,
  maxDeviationBps: number = DEFAULT_MAX_PRICE_DEVIATION_BPS,
): string | null {
  if (referencePrice <= 0) {
    return "no market reference price available for limit order";
  }
  const min = referencePrice * (1 - maxDeviationBps / 10_000);
  const max = referencePrice * (1 + maxDeviationBps / 10_000);
  if (limitPrice < min || limitPrice > max) {
    return `price must be within ±${maxDeviationBps / 100}% of reference ${referencePrice.toFixed(2)}`;
  }
  return null;
}
