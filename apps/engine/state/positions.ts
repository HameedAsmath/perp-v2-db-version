import { getMarkPrice } from "./markPrices";
import type { Position } from "types";
import type { Side } from "./orderbook";
const positions = new Map<string, Map<string, Position>>(); // userId -> symbol -> position

export function resetPositions() {
  positions.clear();
}

export function openOrAddPosition(
  userId: string,
  symbol: string,
  side: Side,
  quantity: number,
  price: number,
  margin: number,
  leverage: number,
) {
  const userPos = positions.get(userId) ?? new Map<string, Position>();
  positions.set(userId, userPos);
  const existing = userPos.get(symbol);
  if (!existing || existing.side === side) {
    const newQty = (existing?.quantity ?? 0) + quantity;
    const newEntry = existing
      ? (existing.averageEntryPrice * existing.quantity + price * quantity) /
        newQty
      : price;
    userPos.set(symbol, {
      symbol,
      side,
      quantity: newQty,
      averageEntryPrice: newEntry,
      margin: (existing?.margin ?? 0) + margin,
      leverage,
    });
    return;
  }
}

export function getPositionsView(userId: string) {
  const userPos = positions.get(userId);
  const list = userPos ? [...userPos.values()] : [];
  return {
    userId,
    positions: list.map((p) => {
      const mark = getMarkPrice(p.symbol);
      const unrealizedPnl =
        p.side === "long"
          ? (mark - p.averageEntryPrice) * p.quantity
          : (p.averageEntryPrice - mark) * p.quantity;
      const liquidationPrice =
        p.side === "long"
          ? p.averageEntryPrice * (1 - 1 / p.leverage + 0.005)
          : p.averageEntryPrice * (1 + 1 / p.leverage - 0.005);
      return {
        symbol: p.symbol,
        side: p.side,
        quantity: p.quantity,
        averageEntryPrice: p.averageEntryPrice,
        margin: p.margin,
        unrealizedPnl,
        liquidationPrice,
      };
    }),
  };
}

export function getAllPositionsForSymbol(symbol: string) {
  const result: { userId: string; position: Position }[] = [];
  for (const [userId, bySymbol] of positions) {
    const position = bySymbol.get(symbol);
    if (position) result.push({ userId, position });
  }
  return result;
}

export function removePosition(userId: string, symbol: string) {
  positions.get(userId)?.delete(symbol);
}

export function getPositionEquityTotals(
  userId: string,
  getMark: (symbol: string) => number,
) {
  const userPos = positions.get(userId);
  if (!userPos) return { positionMargin: 0, unrealizedPnl: 0 };

  let positionMargin = 0;
  let unrealizedPnl = 0;

  for (const p of userPos.values()) {
    const mark = getMark(p.symbol);
    positionMargin += p.margin;
    unrealizedPnl +=
      p.side === "long"
        ? (mark - p.averageEntryPrice) * p.quantity
        : (p.averageEntryPrice - mark) * p.quantity;
  }

  return { positionMargin, unrealizedPnl };
}

// helpers
export function exportPositions(): Record<string, Record<string, Position>> {
  const out: Record<string, Record<string, Position>> = {};
  for (const [userId, bySymbol] of positions) {
    out[userId] = Object.fromEntries(bySymbol);
  }
  return out;
}

export function importPositions(
  data: Record<string, Record<string, Position>>,
) {
  positions.clear();
  for (const [userId, bySymbol] of Object.entries(data)) {
    positions.set(userId, new Map(Object.entries(bySymbol)));
  }
}
