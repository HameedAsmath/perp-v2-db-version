import { Router } from "express";
import {
  placeOrder,
  resetExchange,
  getUserBalance,
  getUserPositions,
  applyFunding,
  updateMarkPrice,
  getInsuranceFund,
  getAdlEvents,
  getOrderBook,
  getOrders,
  getOrderById,
  getMyFills,
  getMarkets,
  seedOrderbook,
  getKlines,
} from "../controllers/exchange.controller";
import { authMiddleware } from "../middleware/auth";

const exchangeRouter = Router();

exchangeRouter.get("/orderbook/:symbol", getOrderBook); // orderbook is public
exchangeRouter.get("/markets", getMarkets); // markets is public
exchangeRouter.get("/klines/:symbol", getKlines);

if (process.env.NODE_ENV !== "production") {
  exchangeRouter.post("/dev/seed-orderbook", seedOrderbook);
}

exchangeRouter.post("/reset", authMiddleware, resetExchange);
exchangeRouter.post("/orders", authMiddleware, placeOrder);
exchangeRouter.get("/me/balance", authMiddleware, getUserBalance);
exchangeRouter.get("/me/positions", authMiddleware, getUserPositions);
exchangeRouter.get("/me/orders", authMiddleware, getOrders);
exchangeRouter.get("/me/orders/:id", authMiddleware, getOrderById);
exchangeRouter.post("/mark-price", authMiddleware, updateMarkPrice);
exchangeRouter.post("/funding", authMiddleware, applyFunding);
exchangeRouter.get("/insurance-fund/:symbol", authMiddleware, getInsuranceFund);
exchangeRouter.get("/adl-events", authMiddleware, getAdlEvents);
exchangeRouter.get("/orderbook/:symbol", authMiddleware, getOrderBook);
exchangeRouter.get("/me/fills", authMiddleware, getMyFills);

export default exchangeRouter;
