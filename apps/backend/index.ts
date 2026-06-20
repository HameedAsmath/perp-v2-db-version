import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import routes from "./routes";
import { startBackendConsumer } from "./redis/consumer";
import { startOrderBookConsumer } from "./redis/orderbook-consumer";
import { subscribe, unsubscribe } from "./ws/registry";
import { loopback } from "./redis/loopback";
import type { OrderBookView } from "types";

const port = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());
app.use(routes);

// Wrap Express in a plain HTTP server so we can share the port with WebSocket
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws: WebSocket) => {
  let subscribedSymbol: string | null = null;

  ws.on("message", async (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "subscribe" && typeof msg.symbol === "string") {
        if (subscribedSymbol) {
          unsubscribe(subscribedSymbol, ws); // unsubscribe from the previous symbol
        }
        subscribedSymbol = msg.symbol;
        subscribe(subscribedSymbol!, ws);
        const book = (await loopback({
          messageType: "get_orderbook",
          symbol: msg.symbol,
        })) as OrderBookView;
        ws.send(JSON.stringify(book));
      }
    } catch (error) {
      console.error(error);
    }
  });

  ws.on("close", () => {
    if (subscribedSymbol) unsubscribe(subscribedSymbol, ws);
  });
});

startBackendConsumer();
startOrderBookConsumer(); // push to WS clients

httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
