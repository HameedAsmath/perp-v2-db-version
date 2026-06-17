import type { Request, Response } from "express";
import { loopback } from "../redis/loopback";
import {
  prisma,
  serializeOrder,
  serializeFill,
  listActiveMarkets,
  serializeMarket,
  getInsuranceFundBySlug,
  serializeInsuranceFund,
  serializeAdlEvent,
  serializeLiquidation,
} from "database";
import type { PlaceOrderRequest } from "types";
import { placeOrderSchema } from "../validators/exchange.schema";
import { parseBody } from "../utils/jwt";

export async function resetExchange(req: Request, res: Response) {
  try {
    const data = await loopback({ messageType: "reset" });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to reset exchange" });
  }
}

export async function placeOrder(req: Request, res: Response) {
  const parsed = parseBody(placeOrderSchema, req.body, res);
  if (!parsed) return;
  const { userId, symbol, side, type, quantity, price, leverage, postOnly } =
    parsed;
  try {
    const data = await loopback({
      messageType: "place_order",
      userId,
      symbol,
      side,
      type,
      quantity: String(quantity),
      price: String(price ?? 0),
      leverage: String(leverage ?? 1),
      postOnly: String(postOnly ?? false),
    });
    res.status(200).json(data);
  } catch {
    res.status(500).json({ error: "Failed to place order" });
  }
}

export async function getUserBalance(req: Request, res: Response) {
  const userId = req.userId as string;
  try {
    const data = await loopback({
      messageType: "get_balance",
      userId,
    });
    res.status(200).json(data);
  } catch {
    res.status(500).json({ error: "Failed to get user balance" });
  }
}

export async function getUserPositions(req: Request, res: Response) {
  const userId = req.userId as string;
  try {
    const data = await loopback({
      messageType: "get_positions",
      userId,
    });
    res.status(200).json(data);
  } catch {
    res.status(500).json({ error: "Failed to get user positions" });
  }
}

export async function updateMarkPrice(req: Request, res: Response) {
  const { symbol, markPrice, timestamp, runLiquidation } = req.body;
  try {
    const data = await loopback({
      messageType: "update_mark_price",
      symbol,
      markPrice: String(markPrice),
      timestamp: String(timestamp ?? Date.now()),
      runLiquidation: String(runLiquidation ?? true),
    });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to update mark price",
    });
  }
}

export async function applyFunding(req: Request, res: Response) {
  const { symbol, rate, timestamp, runLiquidation } = req.body;
  try {
    const data = await loopback({
      messageType: "apply_funding",
      symbol,
      rate: String(rate),
      timestamp: String(timestamp ?? Date.now()),
      runLiquidation: String(runLiquidation ?? true),
    });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to apply funding",
    });
  }
}

export async function getOrderBook(req: Request, res: Response) {
  const symbol = req.params.symbol as string;
  try {
    const data = await loopback({
      messageType: "get_orderbook",
      symbol,
    });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get orderbook",
    });
  }
}

export async function getOrders(req: Request, res: Response) {
  const userId = req.userId as string;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  res.json({ orders: orders.map(serializeOrder) });
}

export async function getOrderById(req: Request, res: Response) {
  const userId = req.userId as string;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  const order = await prisma.order.findFirst({
    where: { id: req.params.id as string, userId },
  });
  if (!order) return res.status(404).json({ error: "order not found" });
  res.json({ order: serializeOrder(order) });
}

export async function getMyFills(req: Request, res: Response) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });

  const fills = await prisma.fill.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  res.json({ fills: fills.map(serializeFill) });
}

export async function getMarkets(_req: Request, res: Response) {
  const markets = await listActiveMarkets();
  res.json({ markets: markets.map(serializeMarket) });
}

export async function getInsuranceFund(req: Request, res: Response) {
  const slug = req.params.symbol as string;
  const fund = await getInsuranceFundBySlug(slug);
  if (!fund) return res.json({ symbol: slug, balance: 0 });
  res.json(serializeInsuranceFund(fund, fund.market.slug));
}
export async function getAdlEvents(req: Request, res: Response) {
  const events = await prisma.adlEvent.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json({ events: events.map(serializeAdlEvent) });
}
export async function getLiquidations(req: Request, res: Response) {
  const userId = req.userId;
  const where = userId ? { userId } : {};
  const rows = await prisma.liquidation.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  res.json({ liquidations: rows.map(serializeLiquidation) });
}
