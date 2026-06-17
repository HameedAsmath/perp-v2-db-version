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
