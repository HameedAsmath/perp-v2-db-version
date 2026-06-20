// aggregate data from fills table
import { prisma } from "../db";
import { getMarketId } from "./orders";

const BUCKET_MS = 60 * 60 * 1000; // 1 hour

export type KlineRow = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export async function getKlinesBySymbol(symbol: string): Promise<KlineRow[]> {
  const marketId = await getMarketId(symbol);

  // Only taker fills — each trade writes maker+taker
  const fills = await prisma.fill.findMany({
    where: { marketId, role: "taker" },
    orderBy: { createdAt: "asc" },
    select: { price: true, quantity: true, createdAt: true },
  });

  if (fills.length === 0) return [];

  const buckets = new Map<number, { prices: number[]; volume: number }>();

  for (const fill of fills) {
    const bucketStartMs =
      Math.floor(fill.createdAt.getTime() / BUCKET_MS) * BUCKET_MS;
    const time = Math.floor(bucketStartMs / 1000);

    let bucket = buckets.get(time);
    if (!bucket) {
      bucket = { prices: [], volume: 0 };
      buckets.set(time, bucket);
    }
    bucket.prices.push(fill.price);
    bucket.volume += fill.quantity;
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, b]) => ({
      time,
      open: b.prices[0]!,
      high: Math.max(...b.prices),
      low: Math.min(...b.prices),
      close: b.prices[b.prices.length - 1]!,
      volume: b.volume,
    }));
}
