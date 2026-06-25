import type { EngineResponse, ToEngine } from "types";
import { resetAll } from "../state/reset";
import { createUser, getBalanceView } from "../state/users";
import { getOrderBookView, placeOrder } from "../state/orderbook";
import { updateMarkPrice } from "./markPrice";
import { applyFunding } from "./funding";
import { getPositionsView } from "../state/positions";
import { resetOrders } from "../db/orders";
import { resetFills } from "../db/fills";
import { resetAdlEvents } from "../db/adl";
import { resetLiquidations } from "../db/liquidations";
import { resetInsurance } from "../db/insurance";
import { seedOrderbook } from "../seed/orderbook";
import { publishOrderBook } from "../redis/orderbook-publisher";

export async function dispatch(
  message: ToEngine & { correlationId: string },
): Promise<EngineResponse> {
  switch (message.messageType) {
    case "reset":
      resetAll();
      await resetAdlEvents();
      await resetLiquidations();
      await resetInsurance();
      await resetFills();
      await resetOrders();
      return {
        ok: true,
        data: { ok: true },
      };
    case "create_user":
      createUser(message.userId, Number(message.initialBalance));
      return {
        ok: true,
        data: { ok: true, userId: message.userId },
      };
    case "place_order":
      const result = await placeOrder({
        userId: message.userId,
        symbol: message.symbol,
        side: message.side,
        type: message.type,
        quantity: Number(message.quantity),
        price: Number(message.price),
        leverage: Number(message.leverage),
        postOnly: message.postOnly === "true",
        slippage: Number(message.slippage),
      });
      await publishOrderBook(message.symbol); // publish the order book to the redis stream to broadcast
      return {
        ok: true,
        data: result,
      };
    case "get_balance":
      return {
        ok: true,
        data: getBalanceView(message.userId),
      };
    case "update_mark_price":
      return {
        ok: true,
        data: await updateMarkPrice(
          message.symbol,
          Number(message.markPrice),
          message.runLiquidation === "true",
        ),
      };
    case "apply_funding":
      return {
        ok: true,
        data: await applyFunding(
          message.symbol,
          Number(message.rate),
          message.runLiquidation === "true",
        ),
      };
    // case "get_insurance_fund":
    //   return {
    //     ok: true,
    //     data: getInsuranceFundView(message.symbol),
    //   };
    // case "get_adl_events":
    //   return {
    //     ok: true,
    //     data: getAdlEventsView(),
    //   };
    case "get_orderbook":
      return {
        ok: true,
        data: getOrderBookView(message.symbol),
      };
    case "get_positions":
      return {
        ok: true,
        data: getPositionsView(message.userId),
      };
    case "seed_orderbook":
      return {
        ok: true,
        data: await seedOrderbook(message.userId, message.symbol),
      };
    default:
      return {
        ok: false,
        error: `unknown dispatch method`,
      };
  }
}
