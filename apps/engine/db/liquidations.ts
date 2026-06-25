import { prisma, getMarketId } from "database";
import type { Position } from "types";

export async function persistLiquidation(input: {
  userId: string;
  symbol: string;
  position: Position;
  markPrice: number;
  settlement: number;
  reason: string;
}) {
  const marketId = await getMarketId(input.symbol);

  return prisma.liquidation.create({
    data: {
      userId: input.userId,
      marketId,
      side: input.position.side,
      quantity: input.position.quantity,
      entryPrice: input.position.averageEntryPrice,
      markPrice: input.markPrice,
      margin: input.position.margin,
      settlement: input.settlement,
      reason: input.reason,
    },
  });
}

export async function resetLiquidations() {
  await prisma.liquidation.deleteMany();
}
