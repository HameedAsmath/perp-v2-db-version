import { publisher } from "./client";
import { getOrderBookView } from "../state/orderbook";

export async function publishOrderBook(symbol: string) {
  const orderbook = getOrderBookView(symbol);
  await publisher.xAdd("orderbook-updates", "*", {
    symbol,
    data: JSON.stringify(orderbook),
  });
}
