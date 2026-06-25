import { getAllPositionsForSymbol, removePosition } from "../state/positions";
import { getUser } from "../state/users";
import type { Position } from "types";
import { persistAdlEvent } from "../db/adl";

function unrealizedPnl(position: Position, mark: number): number {
  return position.side === "long"
    ? (mark - position.averageEntryPrice) * position.quantity
    : (position.averageEntryPrice - mark) * position.quantity;
}

/** Reduce profitable opposite-side positions until shortfall covered */
export async function runAdl(
  symbol: string,
  shortfall: number,
  bankruptcyPrice: number,
  bankruptSide: "long" | "short",
) {
  const targetSide = bankruptSide === "long" ? "short" : "long";

  const candidates = getAllPositionsForSymbol(symbol)
    .filter(({ position }) => position.side === targetSide)
    .map((row) => ({
      ...row,
      upnl: unrealizedPnl(row.position, bankruptcyPrice),
    }))
    .filter((row) => row.upnl > 0)
    .sort((a, b) => b.position.leverage - a.position.leverage);

  let remaining = shortfall;

  for (const { userId, position } of candidates) {
    if (remaining <= 0) break;

    const profitPerUnit =
      position.side === "short"
        ? position.averageEntryPrice - bankruptcyPrice
        : bankruptcyPrice - position.averageEntryPrice;

    if (profitPerUnit <= 0) continue;

    const reduceQty = Math.min(position.quantity, remaining / profitPerUnit);

    applyAdlReduction(userId, position, reduceQty, bankruptcyPrice);
    await persistAdlEvent({
      userId,
      symbol,
      reducedQuantity: reduceQty,
      bankruptcyPrice,
    });

    remaining -= reduceQty * profitPerUnit;
  }
}

function applyAdlReduction(
  userId: string,
  position: Position,
  reduceQty: number,
  mark: number,
): void {
  const user = getUser(userId);
  const closedMargin = (position.margin / position.quantity) * reduceQty;
  const pnl =
    position.side === "long"
      ? (mark - position.averageEntryPrice) * reduceQty
      : (position.averageEntryPrice - mark) * reduceQty;

  user.availableBalance += closedMargin + pnl;
  user.realizedPnl += pnl;

  position.quantity -= reduceQty;
  position.margin -= closedMargin;

  if (position.quantity <= 0) {
    removePosition(userId, position.symbol);
  }
}
