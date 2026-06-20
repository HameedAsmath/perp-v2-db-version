import { openOrAddPosition } from "./positions";
import { getUser, requiredMargin, type UserAccount } from "./users";
import type { RestingOrder } from "types";
import {
  persistRejectedOrder,
  persistMakerFill,
  persistPlacedOrder,
} from "../db/orders";
import { persistTradeFill } from "../db/fills";
import { getMarket } from "./markets";

export type Side = "long" | "short";
export type OrderType = "limit" | "market";
export type Status =
  | "resting"
  | "filled"
  | "partially_filled"
  | "cancelled"
  | "rejected";

export type PlaceOrderInput = {
  userId: string;
  symbol: string;
  side: Side;
  type: OrderType;
  quantity: number;
  price: number;
  leverage?: number;
  postOnly?: boolean;
};

export type Fill = {
  price: number;
  quantity: number;
  makerOrderId: string;
  makerUserId: string;
  makerSide: Side;
  takerUserId: string;
};

export type OrderResponse = {
  orderId: string;
  status: Status;
  reason?: string;
  fills: Fill[];
  remainingQuantity: number;
  cancelledQuantity: number;
  margin: { locked: number; used: number; released: number };
};

const orderbook = new Map<
  string,
  { bids: RestingOrder[]; asks: RestingOrder[] }
>();

export function resetOrderbook() {
  orderbook.clear();
}

function getOrderbook(symbol: string) {
  if (!orderbook.has(symbol)) orderbook.set(symbol, { bids: [], asks: [] });
  return orderbook.get(symbol)!;
}

export function addRestingOrder(order: RestingOrder) {
  const book = getOrderbook(order.symbol);
  if (order.side === "long") {
    book.bids.push(order);
  } else {
    book.asks.push(order);
  }
}

export function cancelRestingOrder(order: RestingOrder) {
  const sideBook =
    order.side === "long"
      ? getOrderbook(order.symbol).bids
      : getOrderbook(order.symbol).asks;
  const idx = sideBook.findIndex((o) => o.orderId === order.orderId);
  if (idx >= 0) sideBook.splice(idx, 1);
}

export function getOrderBookView(symbol: string) {
  const book = getOrderbook(symbol);
  const sortBids = [...book.bids].sort(
    (a, b) =>
      b.price !== a.price ? b.price - a.price : a.createdAt - b.createdAt, // sort by price descending(1st priority), then by createdAt ascending(2nd priority)
  );
  const sortAsks = [...book.asks].sort(
    (a, b) =>
      a.price !== b.price ? a.price - b.price : a.createdAt - b.createdAt, // sort by price ascending(1st priority), then by createdAt ascending(2nd priority)
  );
  return {
    symbol,
    bids: sortBids,
    asks: sortAsks,
  };
}

export function getMatchableMakers(symbol: string, takerSide: Side) {
  const view = getOrderBookView(symbol);
  const makers = takerSide === "long" ? view.asks : view.bids;
  return makers;
}

export function wouldCross(symbol: string, side: Side, price: number) {
  // used to find if an order will match immediately or it will rest in the book
  const makers = getMatchableMakers(symbol, side);
  if (makers.length === 0) return false;
  const best = makers[0]!;
  return side === "long" ? best.price <= price : best.price >= price; // immediate matching
}

function wouldExceedLockedMargin( // for market order
  makers: RestingOrder[],
  requestedQuantity: number,
  leverage: number,
  lockedMargin: number,
): boolean {
  let quantityLeftToFill = requestedQuantity;
  let totalMarginRequired = 0;

  for (const maker of makers) {
    if (quantityLeftToFill <= 0) {
      break;
    }

    const fillQuantity = Math.min(quantityLeftToFill, maker.quantity);

    totalMarginRequired += requiredMargin(maker.price, fillQuantity, leverage);

    quantityLeftToFill -= fillQuantity;
  }

  const canFullyFillOrder = quantityLeftToFill === 0;

  return canFullyFillOrder && totalMarginRequired > lockedMargin;
}

function applyMakerFill(
  maker: RestingOrder,
  fillQty: number,
  fillPrice: number,
) {
  const makerUser = getUser(maker.userId);
  const limitLockReleased = requiredMargin(
    maker.price,
    fillQty,
    maker.leverage,
  );

  makerUser.lockedMargin -= limitLockReleased;
  maker.quantity -= fillQty;

  const positionMargin = requiredMargin(fillPrice, fillQty, maker.leverage);

  openOrAddPosition(
    maker.userId,
    maker.symbol,
    maker.side,
    fillQty,
    fillPrice,
    positionMargin,
    maker.leverage,
  );
}

function applyTakerFill(
  input: PlaceOrderInput,
  fillQty: number,
  fillPrice: number,
  fillMargin: number,
) {
  openOrAddPosition(
    input.userId,
    input.symbol,
    input.side,
    fillQty,
    fillPrice,
    fillMargin,
    input.leverage ?? 1,
  );
}

function finalizeMarketOrder(
  user: UserAccount,
  initialLock: number,
  marginUsed: number,
  remaining: number,
  fills: Fill[],
  orderId: string,
  input: PlaceOrderInput,
) {
  const filled = input.quantity - remaining;
  const cancelled = remaining;

  // release unused locked margin back to available
  const marginReleased = initialLock - marginUsed;
  user.lockedMargin -= initialLock;
  user.availableBalance += marginReleased;
  // marginUsed now lives in positions[].margin

  let status: OrderResponse["status"];
  if (filled === 0)
    status = "cancelled"; // or rejected — test 10 accepts both
  else if (cancelled > 0) status = "partially_filled";
  else status = "filled";

  return {
    orderId,
    status,
    fills,
    remainingQuantity: 0,
    cancelledQuantity: cancelled,
    margin: { locked: initialLock, used: marginUsed, released: marginReleased },
  };
}

function finalizeLimitOrder(
  user: UserAccount,
  initialLock: number,
  marginUsed: number,
  remaining: number,
  fills: Fill[],
  orderId: string,
  input: PlaceOrderInput,
) {
  if (remaining > 0) {
    // rest remainder — keep its limit-price lock in lockedMargin (already there)
    addRestingOrder({
      orderId,
      ...input,
      quantity: remaining,
      leverage: input.leverage ?? 1,
      createdAt: Date.now(),
    });
  }

  const remainderLock =
    remaining > 0
      ? requiredMargin(input.price, remaining, input.leverage ?? 1)
      : 0;

  // Replace locked slice: full initial lock → only remainder on book
  user.lockedMargin = user.lockedMargin - initialLock + remainderLock;

  let status =
    remaining === 0 && fills.length > 0
      ? "filled"
      : fills.length > 0
        ? "partially_filled"
        : "resting";

  return {
    orderId,
    status: status as Status,
    fills,
    remainingQuantity: remaining,
    cancelledQuantity: 0,
    margin: { locked: initialLock, used: marginUsed, released: 0 },
  };
}

function rejected(orderId: string, qty: number, reason: string): OrderResponse {
  return {
    orderId,
    status: "rejected",
    reason,
    fills: [],
    remainingQuantity: 0,
    cancelledQuantity: qty,
    margin: { locked: 0, used: 0, released: 0 },
  };
}

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<OrderResponse> {
  const orderId = crypto.randomUUID();
  const user = getUser(input.userId);
  const market = await getMarket(input.symbol);
  const leverage = input.leverage ?? 1;
  const fills: Fill[] = [];

  const initialLock = requiredMargin(input.price, input.quantity, leverage);

  // Step 1: post-only check (before any lock) user wants to be a maker
  if (input.postOnly && input.type === "limit" && input.price != null) {
    // post only true means user wants that order to be sit on orderbook
    if (wouldCross(input.symbol, input.side, input.price)) {
      await persistRejectedOrder(
        orderId,
        input,
        "post-only order would take liquidity",
      ); // add it in the orders table
      return rejected(
        orderId,
        input.quantity,
        "post-only order would take liquidity",
      );
    }
  }
  // Step 2: pre-trade margin check and order size check and leverage check
  if (user.availableBalance < initialLock) {
    await persistRejectedOrder(orderId, input, "insufficient margin");
    return rejected(orderId, input.quantity, "insufficient margin");
  }

  if (
    input.quantity < market.minOrderSize ||
    input.quantity > market.maxOrderSize
  ) {
    await persistRejectedOrder(orderId, input, "invalid order size");
    return rejected(orderId, input.quantity, "invalid order size");
  }

  if (leverage > market.maxLeverage) {
    await persistRejectedOrder(orderId, input, "leverage exceeds max");
    return rejected(orderId, input.quantity, "leverage exceeds max");
  }

  // Step 3: lock initial margin
  user.availableBalance -= initialLock;
  user.lockedMargin += initialLock;

  // let marginLocked = initialLock;
  let marginUsed = 0;
  // let marginReleased = 0;
  let remaining = input.quantity;
  // Step 4: matching loop
  const makers = getMatchableMakers(input.symbol, input.side);
  let makerIdx = 0;
  while (remaining > 0 && makerIdx < makers.length) {
    const maker = makers[makerIdx]!;
    // limit taker: break if price is already crossed
    if (input.type === "limit" && input.price != null) {
      if (input.side === "long" && maker.price > input.price) break;
      if (input.side === "short" && maker.price < input.price) break;
    }
    const fillQty = Math.min(remaining, maker.quantity);
    const fillPrice = maker.price;
    const fillMargin = requiredMargin(fillPrice, fillQty, leverage);
    // Market: check if this fill (or full remaining) is affordable because it can go above locked price
    if (
      input.type === "market" &&
      wouldExceedLockedMargin(makers, input.quantity, leverage, initialLock)
    ) {
      user.availableBalance += initialLock;
      user.lockedMargin -= initialLock;
      await persistRejectedOrder(orderId, input, "insufficient margin"); // add it in the orders table
      return rejected(orderId, input.quantity, "insufficient margin");
    }

    // Execute fill
    fills.push({
      price: fillPrice,
      quantity: fillQty,
      makerOrderId: maker.orderId,
      makerUserId: maker.userId,
      takerUserId: input.userId,
      makerSide: maker.side,
    });
    applyMakerFill(maker, fillQty, fillPrice); // update maker book + maker user margin + maker position
    await persistMakerFill(maker.orderId, maker.quantity, fillQty); // change the orders table
    // await persistTradeFill({
    //   // add it in the fills table
    //   symbol: input.symbol,
    //   price: fillPrice,
    //   quantity: fillQty,
    //   makerOrderId: maker.orderId,
    //   makerUserId: maker.userId,
    //   makerSide: maker.side,
    //   takerOrderId: orderId, // incoming placed order
    //   takerUserId: input.userId,
    //   takerSide: input.side,
    // });
    applyTakerFill(input, fillQty, fillPrice, fillMargin);
    marginUsed += fillMargin;
    remaining -= fillQty;
    if (maker.quantity === 0) {
      cancelRestingOrder(maker); // remove from orderbook
      makerIdx++; // move to next maker
    }
  }

  // Step 5: finalize margin + persist placed order
  const response =
    input.type === "market"
      ? finalizeMarketOrder(
          user,
          initialLock,
          marginUsed,
          remaining,
          fills,
          orderId,
          input,
        )
      : finalizeLimitOrder(
          user,
          initialLock,
          marginUsed,
          remaining,
          fills,
          orderId,
          input,
        );

  await persistPlacedOrder(orderId, input, response);
  for (const fill of response.fills) {
    await persistTradeFill({
      symbol: input.symbol,
      price: fill.price,
      quantity: fill.quantity,
      makerOrderId: fill.makerOrderId,
      makerUserId: fill.makerUserId,
      makerSide: fill.makerSide,
      takerOrderId: orderId,
      takerUserId: input.userId,
      takerSide: input.side,
    });
  }
  return response;
}

// helpers
export function exportOrderbook() {
  return Object.fromEntries(orderbook);
}

export function importOrderbook(
  data: Record<string, { bids: RestingOrder[]; asks: RestingOrder[] }>,
) {
  orderbook.clear();
  for (const [symbol, book] of Object.entries(data)) {
    orderbook.set(symbol, { bids: [...book.bids], asks: [...book.asks] });
  }
}
