/**
 * Seeds 10 bids + 10 asks on BTC-PERP via the running backend API.
 *
 * Prerequisites: Redis, engine, and backend must be running.
 * Restart the engine after pulling changes so seed_orderbook handler is loaded.
 *
 * Usage:
 *   bun run seed:orderbook
 *   USER_ID=your-uuid bun run seed:orderbook
 */

const API_URL = process.env.API_URL ?? "http://localhost:4000";
const SYMBOL = process.env.SYMBOL ?? "BTC-PERP";
const USER_ID = process.env.USER_ID ?? "639a13a0-f153-48e2-9b1f-2b2647b79f66";

type SeedResult = {
  symbol: string;
  placed: number;
  rejected: number;
  book: { bids: { price: number }[]; asks: { price: number }[] };
  orders: Array<{
    side: string;
    price: number;
    status: string;
    reason?: string;
  }>;
};

async function main() {
  console.log(`Seeding ${SYMBOL} for user ${USER_ID}...`);

  const res = await fetch(`${API_URL}/api/dev/seed-orderbook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: USER_ID, symbol: SYMBOL }),
  });

  const body = (await res.json()) as SeedResult & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  for (const o of body.orders) {
    const tag = o.side === "long" ? "BID" : "ASK";
    console.log(
      `  ${tag} ${o.price} → ${o.status}${o.reason ? ` (${o.reason})` : ""}`,
    );
  }

  console.log(`\nDone: ${body.placed} placed, ${body.rejected} rejected`);
  console.log(
    `Orderbook: ${body.book.bids.length} bids, ${body.book.asks.length} asks`,
  );
  console.log(`  best bid: ${body.book.bids[0]?.price ?? "—"}`);
  console.log(`  best ask: ${body.book.asks[0]?.price ?? "—"}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("seed-orderbook failed:", err);
  process.exit(1);
});
