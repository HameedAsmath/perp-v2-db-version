"use client"

import { useEffect, useRef, useState } from "react"
import type { OrderBookView } from "types"
import { OrderBook } from "./orderbook"

type OrderBookPanelProps = {
  symbol?: string
  wsUrl?: string
}

function emptyBook(symbol: string): OrderBookView {
  return { symbol, bids: [], asks: [] }
}

export function OrderBookPanel({
  symbol = "BTC-PERP",
  wsUrl = "ws://localhost:4000",
}: OrderBookPanelProps) {
  const [data, setData] = useState<OrderBookView>(() => emptyBook(symbol))

  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let stopped = false
    let retryTimer: ReturnType<typeof setTimeout>

    function connect() {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "subscribe", symbol }))
      }

      ws.onmessage = (event) => {
        try {
          const book = JSON.parse(event.data as string) as OrderBookView
          if (book.symbol === symbol) setData(book)
        } catch (error) {
          // ignore malformed frames
          console.error(error)
        }
      }

      ws.onclose = () => {
        if (!stopped) retryTimer = setTimeout(connect, 2000) // reconnect after 2s
      }
    }

    connect()

    return () => {
      stopped = true
      clearTimeout(retryTimer)
      wsRef.current?.close()
    }
  }, [symbol, wsUrl])

  return <OrderBook data={data} />
}
