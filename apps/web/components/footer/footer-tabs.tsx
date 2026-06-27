"use client"

import { useEffect, useMemo, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  getBalanceApi,
  getFillsApi,
  getMarketsApi,
  getOrdersApi,
  getPositionsApi,
  type Fill,
  type Order,
  type Position,
} from "@/services/orders"

type Balance = {
  availableBalance: number
  lockedMargin?: number
  realizedPnl?: number
  totalEquity: number
}

function fmt(n: number, digits = 2) {
  return n.toLocaleString("en-US", { maximumFractionDigits: digits })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString()
}

function SideBadge({ side }: { side: "long" | "short" }) {
  return (
    <span
      className={cn(
        "capitalize",
        side === "long" ? "text-green-text" : "text-red-text"
      )}
    >
      {side}
    </span>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>
  )
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-xs">
        {children}
      </table>
    </div>
  )
}

export function FooterTabs() {
  const [balance, setBalance] = useState<Balance | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [fills, setFills] = useState<Fill[]>([])
  const [marketMap, setMarketMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [b, pos, ords, fls, markets] = await Promise.all([
          getBalanceApi(),
          getPositionsApi(),
          getOrdersApi(),
          getFillsApi(),
          getMarketsApi(),
        ])
        if (cancelled) return

        setBalance(b as Balance)
        setPositions(pos.positions)
        setOrders(ords)
        setFills(fls)
        setMarketMap(Object.fromEntries(markets.map((m) => [m.id, m.slug])))
        setError(null)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load account data")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const id = setInterval(() => void load(), 10_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const symbol = (marketId: string) =>
    marketMap[marketId] ?? marketId.slice(0, 8)

  const openOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.status === "resting" || o.status === "partially_filled"
      ),
    [orders]
  )

  return (
    <Tabs
      defaultValue="balances"
      className="flex h-full min-h-0 w-full flex-col"
    >
      <TabsList
        variant="line"
        className="h-9 w-full shrink-0 justify-start rounded-none border-b border-border/60 bg-transparent px-2"
      >
        <TabsTrigger value="balances" className="text-xs">
          Balances
        </TabsTrigger>
        <TabsTrigger value="open-orders" className="text-xs">
          Open Orders
        </TabsTrigger>
        <TabsTrigger value="fills" className="text-xs">
          Fill History
        </TabsTrigger>
        <TabsTrigger value="orders" className="text-xs">
          Order History
        </TabsTrigger>
      </TabsList>

      {error && (
        <p className="shrink-0 px-3 py-1 text-xs text-red-text">{error}</p>
      )}

      {loading ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Loading…
        </p>
      ) : (
        <>
          {/* Balances */}
          <TabsContent
            value="balances"
            className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
          >
            {balance && (
              <div className="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">Available</span>
                  <p className="tabular-nums">
                    ${fmt(balance.availableBalance)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Locked</span>
                  <p className="tabular-nums">
                    ${fmt(balance.lockedMargin ?? 0)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Realized PnL</span>
                  <p className="tabular-nums">
                    ${fmt(balance.realizedPnl ?? 0)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Equity</span>
                  <p className="tabular-nums">${fmt(balance.totalEquity)}</p>
                </div>
              </div>
            )}

            {positions.length === 0 ? (
              <Empty text="No open positions" />
            ) : (
              <TableWrap>
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="py-1.5 pr-2">Symbol</th>
                    <th className="py-1.5 pr-2">Side</th>
                    <th className="py-1.5 pr-2 text-right">Size</th>
                    <th className="py-1.5 pr-2 text-right">Entry</th>
                    <th className="py-1.5 pr-2 text-right">uPnL</th>
                    <th className="py-1.5 text-right">Liq.</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.symbol} className="border-b border-border/30">
                      <td className="py-1.5 pr-2">{p.symbol}</td>
                      <td className="py-1.5 pr-2">
                        <SideBadge side={p.side} />
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {p.quantity}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {fmt(p.averageEntryPrice, 1)}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 pr-2 text-right tabular-nums",
                          p.unrealizedPnl >= 0
                            ? "text-green-text"
                            : "text-red-text"
                        )}
                      >
                        {fmt(p.unrealizedPnl, 2)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {fmt(p.liquidationPrice, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </TabsContent>

          {/* Open Orders */}
          <TabsContent
            value="open-orders"
            className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
          >
            {openOrders.length === 0 ? (
              <Empty text="No open orders" />
            ) : (
              <TableWrap>
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="py-1.5 pr-2">Symbol</th>
                    <th className="py-1.5 pr-2">Side</th>
                    <th className="py-1.5 pr-2">Type</th>
                    <th className="py-1.5 pr-2 text-right">Price</th>
                    <th className="py-1.5 pr-2 text-right">Qty</th>
                    <th className="py-1.5 pr-2 text-right">Filled</th>
                    <th className="py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {openOrders.map((o) => (
                    <tr key={o.id} className="border-b border-border/30">
                      <td className="py-1.5 pr-2">{symbol(o.marketId)}</td>
                      <td className="py-1.5 pr-2">
                        <SideBadge side={o.side} />
                      </td>
                      <td className="py-1.5 pr-2 capitalize">{o.type}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {o.price != null ? fmt(o.price, 1) : "—"}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {o.qty}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {o.filledQty}/{o.qty}
                      </td>
                      <td className="py-1.5 capitalize">
                        {o.status.replace("_", " ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </TabsContent>

          {/* Fill History */}
          <TabsContent
            value="fills"
            className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
          >
            {fills.length === 0 ? (
              <Empty text="No fills yet" />
            ) : (
              <TableWrap>
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="py-1.5 pr-2">Time</th>
                    <th className="py-1.5 pr-2">Symbol</th>
                    <th className="py-1.5 pr-2">Side</th>
                    <th className="py-1.5 pr-2">Role</th>
                    <th className="py-1.5 pr-2 text-right">Price</th>
                    <th className="py-1.5 pr-2 text-right">Qty</th>
                    <th className="py-1.5 text-right">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {fills.map((f) => (
                    <tr key={f.id} className="border-b border-border/30">
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        {fmtTime(f.createdAt)}
                      </td>
                      <td className="py-1.5 pr-2">{symbol(f.marketId)}</td>
                      <td className="py-1.5 pr-2">
                        <SideBadge side={f.side} />
                      </td>
                      <td className="py-1.5 pr-2 capitalize">{f.role}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {fmt(f.price, 1)}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {f.quantity}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {fmt(f.fee, 4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </TabsContent>

          {/* Order History */}
          <TabsContent
            value="orders"
            className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
          >
            {orders.length === 0 ? (
              <Empty text="No orders yet" />
            ) : (
              <TableWrap>
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="py-1.5 pr-2">Time</th>
                    <th className="py-1.5 pr-2">Symbol</th>
                    <th className="py-1.5 pr-2">Side</th>
                    <th className="py-1.5 pr-2">Type</th>
                    <th className="py-1.5 pr-2 text-right">Price</th>
                    <th className="py-1.5 pr-2 text-right">Qty</th>
                    <th className="py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-border/30">
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        {fmtTime(o.createdAt)}
                      </td>
                      <td className="py-1.5 pr-2">{symbol(o.marketId)}</td>
                      <td className="py-1.5 pr-2">
                        <SideBadge side={o.side} />
                      </td>
                      <td className="py-1.5 pr-2 capitalize">{o.type}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {o.price != null ? fmt(o.price, 1) : "—"}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {o.qty}
                      </td>
                      <td className="py-1.5 capitalize">
                        {o.status.replace("_", " ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </TabsContent>
        </>
      )}
    </Tabs>
  )
}
