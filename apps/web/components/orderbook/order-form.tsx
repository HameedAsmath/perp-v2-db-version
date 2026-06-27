"use client"

import { useEffect, useMemo, useState } from "react"
import axios from "axios"
import Link from "next/link"
import type { MarketInfo, OrderSide, OrderType, PlaceOrderRequest } from "types"
import {
  getDefaultMarkPrice,
  validatePriceBand,
  validateQuantityStep,
  validateTickSize,
} from "types"
import { useAuth } from "@/contexts/auth-provider"
import {
  getBalanceApi,
  getMarketsApi,
  getMarketPrice,
  getOrderBookApi,
  placeOrderApi,
} from "@/services/orders"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type OrderFormProps = {
  symbol?: string
}

export function OrderForm({ symbol = "BTC-PERP" }: OrderFormProps) {
  const { isLoggedIn, userId } = useAuth()

  const [side, setSide] = useState<OrderSide>("long")
  const [type, setType] = useState<OrderType>("limit")
  const [price, setPrice] = useState("")
  const [quantity, setQuantity] = useState("")
  const [availableBalance, setAvailableBalance] = useState(0)
  const [bestBid, setBestBid] = useState(0)
  const [bestAsk, setBestAsk] = useState(0)
  const [market, setMarket] = useState<MarketInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageIsError, setMessageIsError] = useState(false)
  const [slippageBps, setSlippageBps] = useState(100)

  const isLong = side === "long"
  const isLimit = type === "limit"

  const marketRef = getDefaultMarkPrice(symbol)

  const referencePrice = useMemo(() => {
    if (isLimit) return Number(price) || 0
    return isLong ? bestAsk : bestBid
  }, [isLimit, isLong, price, bestAsk, bestBid])

  const qtyNum = Number(quantity) || 0
  const orderValue =
    referencePrice > 0 && qtyNum > 0 ? referencePrice * qtyNum : 0
  const marginRequired = orderValue > 0 ? orderValue : 0 // leverage 1

  const tickSize = market?.tickSize ?? 1
  const qtyStep = market?.minOrderSize ?? 1

  // Load market rules, balance + orderbook for UI
  useEffect(() => {
    void getMarketsApi().then((markets) => {
      setMarket(markets.find((m) => m.slug === symbol) ?? null)
    })
    void getOrderBookApi(symbol).then((book) => {
      setBestBid(book.bids[0]?.price ?? 0)
      setBestAsk(book.asks[0]?.price ?? 0)
    })
    if (isLoggedIn) {
      void getBalanceApi()
        .then((b) => setAvailableBalance(b.availableBalance))
        .catch(() => setAvailableBalance(0))
    }
  }, [symbol, isLoggedIn])

  const slippagePct = slippageBps / 100 // display: 100 bps → 1.00%
  const maxFillPrice = useMemo(() => {
    if (isLimit || referencePrice <= 0 || slippageBps <= 0) return null
    if (isLong) return referencePrice * (1 + slippageBps / 10_000)
    return referencePrice * (1 - slippageBps / 10_000)
  }, [isLimit, isLong, referencePrice, slippageBps])

  async function handlePlaceOrder() {
    if (!isLoggedIn || !userId) return
    setMessage(null)
    setMessageIsError(false)

    if (!market) {
      setMessage("Market rules not loaded")
      setMessageIsError(true)
      return
    }

    if (!qtyNum) {
      setMessage("Enter quantity")
      setMessageIsError(true)
      return
    }

    const qtyErr = validateQuantityStep(
      qtyNum,
      qtyStep,
      market.minOrderSize,
      market.maxOrderSize,
    )
    if (qtyErr) {
      setMessage(qtyErr)
      setMessageIsError(true)
      return
    }

    let orderPrice = referencePrice
    if (!isLimit) {
      orderPrice = await getMarketPrice(symbol, side)
      if (!orderPrice) {
        setMessage("No liquidity for market order")
        setMessageIsError(true)
        return
      }
    } else {
      const limitPrice = Number(price)
      if (!limitPrice) {
        setMessage("Enter price")
        setMessageIsError(true)
        return
      }

      const tickErr = validateTickSize(limitPrice, tickSize)
      if (tickErr) {
        setMessage(tickErr)
        setMessageIsError(true)
        return
      }

      if (marketRef > 0) {
        const bandErr = validatePriceBand(limitPrice, marketRef)
        if (bandErr) {
          setMessage(bandErr)
          setMessageIsError(true)
          return
        }
      }

      orderPrice = limitPrice
    }

    const body: PlaceOrderRequest = {
      userId,
      symbol,
      side,
      type,
      quantity: qtyNum,
      price: orderPrice,
      leverage: 1,
      ...(!isLimit && slippageBps > 0 && { slippage: slippageBps }),
    }

    setLoading(true)
    try {
      const result = await placeOrderApi(body)
      const rejected = result.status === "rejected"
      setMessage(
        rejected
          ? (result.reason ?? "Order rejected")
          : `Order ${result.status}`,
      )
      setMessageIsError(rejected)
      if (!rejected) {
        setQuantity("")
      }
      const b = await getBalanceApi()
      setAvailableBalance(b.availableBalance)
    } catch (error: unknown) {
      const msg =
        axios.isAxiosError(error) &&
        typeof error.response?.data?.error === "string"
          ? error.response.data.error
          : "Order failed"
      setMessage(msg)
      setMessageIsError(true)
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    "h-11 w-full rounded-lg bg-surface px-3 pr-10 text-sm text-foreground outline-none focus:ring-1 focus:ring-border"

  return (
    <div className="flex flex-col gap-4">
      {/* Buy / Long | Sell / Short */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface p-1">
        <button
          type="button"
          onClick={() => setSide("long")}
          className={cn(
            "rounded-md py-2.5 text-sm font-medium transition-colors",
            isLong
              ? "bg-green-bg text-green-text"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Buy / Long
        </button>
        <button
          type="button"
          onClick={() => setSide("short")}
          className={cn(
            "rounded-md py-2.5 text-sm font-medium transition-colors",
            !isLong
              ? "bg-red-bg text-red-text"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Sell / Short
        </button>
      </div>

      {/* Limit | Market */}
      <div className="flex gap-4 border-b border-border text-sm">
        {(["limit", "market"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              "pb-2 capitalize transition-colors",
              type === t
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Available Balance */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Available Balance</span>
        <span>${availableBalance.toFixed(2)}</span>
      </div>

      {/* Price — limit only */}
      {isLimit && (
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Price</span>
          <div className="relative">
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="0.00"
              step={tickSize}
              min={tickSize}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-green-text">
              $
            </span>
          </div>
        </div>
      )}

      {/* Quantity */}
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">Quantity</span>
        <div className="relative">
          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="0"
            step={qtyStep}
            min={qtyStep}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-orange-400">
            ₿
          </span>
        </div>
        {/* <input
          type="range"
          min={0}
          max={100}
          step={25}
          value={percent}
          onChange={(e) => onPercentChange(Number(e.target.value))}
          className="w-full accent-blue-text"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0</span>
          <span>100%</span>
        </div> */}
      </div>

      {/* Order value */}
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">Order Value</span>
        <div className="relative">
          <input
            readOnly
            className={inputClass}
            value={orderValue > 0 ? orderValue.toFixed(2) : "0"}
          />
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-green-text">
            $
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Margin Required</span>
          <span>
            {marginRequired > 0 ? `$${marginRequired.toFixed(2)}` : "—"}
          </span>
        </div>
        {/* <div className="flex justify-between">
          <span className="border-b border-dotted border-muted-foreground text-muted-foreground">
            Est. Liquidation Price
          </span>
          <span>—</span>
        </div> */}
        {/* Max slippage — market only */}
        {!isLimit && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Max Slippage
              </span>
              <span className="text-xs text-muted-foreground">
                {slippagePct.toFixed(2)}%
              </span>
            </div>
            <div className="relative">
              <input
                className={inputClass}
                inputMode="numeric"
                min={1}
                max={100}
                value={slippageBps}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (!Number.isFinite(n)) return
                  setSlippageBps(Math.min(100, Math.max(1, Math.round(n))))
                }}
              />
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                bps
              </span>
            </div>
            <div className="flex gap-2">
              {[50, 100].map((bps) => (
                <button
                  key={bps}
                  type="button"
                  onClick={() => setSlippageBps(bps)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs",
                    slippageBps === bps
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {bps / 100}%
                </button>
              ))}
            </div>
            {maxFillPrice != null && (
              <p className="text-xs text-muted-foreground">
                {isLong ? "Max buy" : "Min sell"} price: $
                {maxFillPrice.toLocaleString("en-US", {
                  maximumFractionDigits: 1,
                })}
              </p>
            )}
          </div>
        )}
      </div>

      {message && (
        <p
          className={cn(
            "text-sm",
            messageIsError ? "text-red-text" : "text-green-text"
          )}
        >
          {message}
        </p>
      )}

      {isLoggedIn ? (
        <Button
          disabled={loading}
          onClick={handlePlaceOrder}
          className={cn(
            "h-11 w-full text-base font-semibold",
            isLong
              ? "bg-green-text text-background hover:bg-green-text/90"
              : "bg-red-text text-white hover:bg-red-text/90"
          )}
        >
          {loading ? "Placing…" : isLong ? "Buy / Long" : "Sell / Short"}
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            asChild
            className="h-11 w-full bg-primary text-primary-foreground"
          >
            <Link href="/signup">Sign up to trade</Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            className="h-11 w-full bg-surface"
          >
            <Link href="/login">Log in to trade</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
