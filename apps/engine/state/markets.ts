import { getMarketBySlug } from "database";

export type Market = {
  id: string;
  slug: string;
  maxLeverage: number;
  minOrderSize: number;
  maxOrderSize: number;
  isActive: boolean;
};

const marketCache = new Map<string, Market>();

export function resetMarkets() {
  marketCache.clear();
}

export async function getMarket(symbol: string): Promise<Market> {
  const res = marketCache.get(symbol);
  if (res) return res;
  try {
    const market = await getMarketBySlug(symbol);
    console.log("[getMarket] DB result:", market?.slug ?? "null");
    if (!market || !market.isActive) {
      throw new Error(`Market not found or inactive: ${symbol}`);
    }
    const marketData = {
      id: market.id,
      slug: market.slug,
      maxLeverage: market.maxLeverage,
      minOrderSize: Number(market.minOrderSize),
      maxOrderSize: Number(market.maxOrderSize),
      isActive: market.isActive,
    };
    marketCache.set(symbol, marketData);
    return marketData;
  } catch (err) {
    console.error("[getMarket] DB error:", err);
    throw err;
  }
}
