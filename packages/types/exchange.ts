// Domain values — same as engine + Prisma
export type OrderSide = "long" | "short";
export type OrderType = "limit" | "market";

// What the frontend POSTs to /api/orders
export type PlaceOrderRequest = {
  userId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price: number;
  leverage?: number;
  postOnly?: boolean;
};

// What the API returns (from engine OrderResponse)
export type PlaceOrderResponse = {
  orderId: string;
  status: string;
  reason?: string;
  fills: Array<{ price: number; quantity: number }>;
  remainingQuantity: number;
  cancelledQuantity: number;
  margin: { locked: number; used: number; released: number };
};

export type RestingOrder = {
  orderId: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  leverage: number;
  createdAt: number;
};

/** Raw order book from the engine / API — already sorted. */
export type OrderBookView = {
  symbol: string;
  bids: RestingOrder[];
  asks: RestingOrder[];
};

/** After aggregation — UI only. */
export type OrderBookPriceLevel = {
  price: number;
  size: number;
  /** Cumulative size from best price outward on this side. */
  total: number;
};

export type OrderBookDisplayMode = "both" | "asks" | "bids";

export type KlineCandle = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type KlinesResponse = {
  symbol: string;
  interval: string; // e.g. "1h"
  candles: KlineCandle[];
};
