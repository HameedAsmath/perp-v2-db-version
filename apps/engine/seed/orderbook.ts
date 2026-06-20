import { getOrderBookView, placeOrder } from "../state/orderbook";

const BID_PRICES = Array.from({ length: 10 }, (_, i) => 940 + i * 5);
const ASK_PRICES = Array.from({ length: 10 }, (_, i) => 1015 + i * 5);

export type SeedOrderbookResult = {
  symbol: string;
  placed: number;
  rejected: number;
  orders: Array<{
    side: string;
    price: number;
    status: string;
    reason?: string;
  }>;
  book: ReturnType<typeof getOrderBookView>;
};

export async function seedOrderbook(
  userId: string,
  symbol: string,
): Promise<SeedOrderbookResult> {
  const orders: SeedOrderbookResult["orders"] = [];
  let placed = 0;
  let rejected = 0;

  for (const price of BID_PRICES) {
    const result = await placeOrder({
      userId,
      symbol,
      side: "long",
      type: "limit",
      quantity: 1,
      price,
      leverage: 1,
    });
    orders.push({
      side: "long",
      price,
      status: result.status,
      reason: result.reason,
    });
    if (result.status === "rejected") rejected++;
    else placed++;
  }

  for (const price of ASK_PRICES) {
    const result = await placeOrder({
      userId,
      symbol,
      side: "short",
      type: "limit",
      quantity: 1,
      price,
      leverage: 1,
    });
    orders.push({
      side: "short",
      price,
      status: result.status,
      reason: result.reason,
    });
    if (result.status === "rejected") rejected++;
    else placed++;
  }

  return {
    symbol,
    placed,
    rejected,
    orders,
    book: getOrderBookView(symbol),
  };
}
