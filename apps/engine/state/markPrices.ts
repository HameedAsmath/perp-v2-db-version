import { getDefaultMarkPrice } from "types";

const markPrices = new Map<string, number>();

export function resetMarkPrices() {
  markPrices.clear();
}

export function setMarkPrice(symbol: string, markPrice: number) {
  markPrices.set(symbol, markPrice);
}

export function getMarkPrice(symbol: string) {
  const stored = markPrices.get(symbol);
  if (stored != null && stored > 0) return stored;
  return getDefaultMarkPrice(symbol);
}
