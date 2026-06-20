// for broadasting to the websocket connections

import { createClient } from "redis";
import { broadcast } from "../ws/registry";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const client = createClient({ url: REDIS_URL });
await client.connect();

export async function startOrderBookConsumer() {
  let lastId = "$"; // only new messages from now on

  while (true) {
    const response = await client.xRead(
      { key: "orderbook-updates", id: lastId },
      { BLOCK: 1000, COUNT: 50 },
    );

    if (!response) continue;

    for (const batch of response) {
      for (const msg of batch.messages) {
        const { symbol, data } = msg.message;
        broadcast(symbol, data); // push raw JSON to all browser tabs watching this symbol
        lastId = msg.id;
      }
    }
  }
}
