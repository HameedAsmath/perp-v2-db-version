export type EngineResponse = {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

export type ToBackend = {
  correlationId: string;
  response: string;
};

export type ToEngineStreamFields = {
  correlationId: string;
  messageType: string;
  [key: string]: string;
};

export type ToEngine =
  | {
      messageType: "reset";
    }
  | {
      messageType: "create_user";
      userId: string;
      initialBalance: string;
    }
  | {
      messageType: "place_order";
      userId: string;
      symbol: string;
      side: "long" | "short";
      type: "market" | "limit";
      quantity: string;
      price: string;
      leverage: string;
      postOnly: string;
      slippage: string;
    }
  | {
      messageType: "get_orderbook";
      symbol: string;
    }
  | {
      messageType: "get_balance";
      userId: string;
    }
  | {
      messageType: "get_positions";
      userId: string;
    }
  | {
      messageType: "update_mark_price";
      symbol: string;
      markPrice: string;
      timestamp: string;
      runLiquidation: string; // "true" | "false" from redis
    }
  | {
      messageType: "apply_funding";
      symbol: string;
      rate: string;
      timestamp: string;
      runLiquidation: string;
    }
  | { messageType: "get_insurance_fund"; symbol: string }
  | { messageType: "get_adl_events" }
  | {
      messageType: "seed_orderbook";
      userId: string;
      symbol: string;
    };
