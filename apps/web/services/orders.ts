import { api } from "../lib/api"
import type {
  KlinesResponse,
  MarketInfo,
  OrderBookView,
  PlaceOrderRequest,
  PlaceOrderResponse,
} from "types"

export type OrderBookResponse = {
  symbol: string
  bids: { price: number; quantity: number }[]
  asks: { price: number; quantity: number }[]
}

export type BalanceResponse = {
  availableBalance: number
  totalEquity: number
}

export type Fill = {
  id: string
  orderId: string
  marketId: string
  side: "long" | "short"
  role: "maker" | "taker"
  quantity: number
  price: number
  fee: number
  createdAt: string
}

export type Position = {
  symbol: string
  side: "long" | "short"
  quantity: number
  averageEntryPrice: number
  margin: number
  unrealizedPnl: number
  liquidationPrice: number
}

export type Order = {
  id: string
  marketId: string
  side: "long" | "short"
  type: "limit" | "market"
  status: "resting" | "filled" | "cancelled" | "partially_filled" | "rejected"
  qty: number
  price: number | null
  filledQty: number
  remainingQty: number
  leverage: number
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
}

export async function placeOrderApi(body: PlaceOrderRequest) {
  const { data } = await api.post<PlaceOrderResponse>("/api/orders", body)
  return data
}

export async function getOrderBookApi(symbol: string) {
  const { data } = await api.get<OrderBookView>(`/api/orderbook/${symbol}`)
  return data
}

export async function getMarketPrice(symbol: string, side: "long" | "short") {
  const book = await getOrderBookApi(symbol)
  return side === "long"
    ? (book.asks[0]?.price ?? 0)
    : (book.bids[0]?.price ?? 0)
}

export async function getBalanceApi() {
  const { data } = await api.get<BalanceResponse>("/api/me/balance")
  return data
}

export async function getKlinesApi(symbol: string) {
  const { data } = await api.get<KlinesResponse>(`/api/klines/${symbol}`)
  return data
}

export async function getPositionsApi() {
  const { data } = await api.get<{ userId: string; positions: Position[] }>(
    "/api/me/positions"
  )
  return data
}

export async function getOrdersApi() {
  const { data } = await api.get<{ orders: Order[] }>("/api/me/orders")
  return data.orders
}

export async function getFillsApi() {
  const { data } = await api.get<{ fills: Fill[] }>("/api/me/fills")
  return data.fills
}

export async function getMarketsApi() {
  const { data } = await api.get<{ markets: MarketInfo[] }>("/api/markets")
  return data.markets
}
