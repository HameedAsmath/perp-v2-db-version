"use client" // runs in the browser, not on the server

import { useEffect, useMemo, useRef, useState } from "react"
import { Minus, Plus } from "lucide-react" // − and + icons for the price stepper
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils" // merges tailwind classnames conditionally
import type { OrderBookDisplayMode, OrderBookView } from "types"
import {
  GROUPING_STEPS, // [0.1, 1, 10, 100, 1000]
  levelsForDisplay, // reverses asks so worst is at top
  prepareSideLevels, // runs the full aggregate → group → cumulative pipeline
  priceDecimalsForStep, // how many decimal places to show at current step
  rawMaxTotal, // largest cumulative total on this side
  smoothMaxTotal, // grow instantly, shrink slowly (×0.9)
} from "@/lib/orderbook/aggregate"
import { OrderBookRow } from "./order-book-row"

type OrderBookProps = {
  data: OrderBookView // the live order book passed in as a prop
  baseAsset?: string // shown in column headers e.g. "BTC"
  maxRows?: number // how many rows to show per side
}

// Small icon showing which display mode is active (both / asks only / bids only)
// Draws a red bar for asks, green bar for bids, or both
function DisplayModeIcon({
  mode,
  active,
}: {
  mode: OrderBookDisplayMode
  active: boolean
}) {
  return (
    <div
      className={cn(
        "flex h-3.5 w-4 flex-col justify-between rounded-[2px] border border-border/60 p-[2px]",
        active && "border-foreground/40" // brighter border when this mode is selected
      )}
    >
      {(mode === "both" || mode === "asks") && (
        <div className="h-[3px] w-full rounded-[1px] bg-red-text/80" /> // red bar = asks
      )}
      {(mode === "both" || mode === "bids") && (
        <div className="h-[3px] w-full rounded-[1px] bg-green-text/80" /> // green bar = bids
      )}
    </div>
  )
}

export function OrderBook({
  data,
  baseAsset = "BTC",
  maxRows = 14,
}: OrderBookProps) {
  // which sides to show: "both" | "asks" | "bids"
  const [displayMode, setDisplayMode] = useState<OrderBookDisplayMode>("both")

  // index into GROUPING_STEPS — starts at 1 which is $1 grouping
  const [stepIdx, setStepIdx] = useState(1)

  // which price row the mouse is currently hovering over (null = none)
  const [hovered, setHovered] = useState<number | null>(null)

  // pointer to the spread row DOM element so we can scroll it into view
  const spreadRef = useRef<HTMLDivElement>(null)

  // Custom hook: keeps a smoothed version of the max total for one side
  // Prevents depth bars from jittering when the book updates
  // Rule: grow to new max instantly, but only shrink by 10% per update
  function useSmoothedMax(rawMax: number): number {
    const [smoothed, setSmoothed] = useState(0)
    useEffect(() => {
      setSmoothed((prev) => smoothMaxTotal(rawMax, prev))
    }, [rawMax])
    return smoothed
  }

  // current grouping step value e.g. 0.1, 1, 10...
  const step = GROUPING_STEPS[stepIdx] ?? 1

  // how many decimal places prices should show at this step (e.g. step=0.1 → 1 decimal)
  const priceDecimals = priceDecimalsForStep(step)

  // Run the full pipeline on bids: aggregate → group by step → cumulative totals
  // useMemo so it only recalculates when the raw bids or step changes, not every render
  const bidLevels = useMemo(
    () => prepareSideLevels(data.bids, "bid", step),
    [data.bids, step]
  )

  // Same pipeline for asks
  const askLevels = useMemo(
    () => prepareSideLevels(data.asks, "ask", step),
    [data.asks, step]
  )

  // Smoothed max total per side — used to calculate each row's depth bar width as a %
  // Asks and bids have separate scales (not shared)
  const askMax = useSmoothedMax(rawMaxTotal(askLevels))
  const bidMax = useSmoothedMax(rawMaxTotal(bidLevels))

  // Asks: reverse so worst (highest) is at top, best (lowest) sits just above spread
  // Slice to maxRows so we don't render hundreds of rows
  const displayAsks = levelsForDisplay(askLevels, "ask").slice(0, maxRows)

  // Bids: keep order as-is (best/highest first, worst at bottom)
  const displayBids = levelsForDisplay(bidLevels, "bid").slice(0, maxRows)

  // best bid = highest price someone will buy at (first item, sorted high→low)
  const bestBid = bidLevels[0]?.price
  // best ask = lowest price someone will sell at (first item, sorted low→high)
  const bestAsk = askLevels[0]?.price

  // last price shown in the spread row — prefer best bid, fallback to best ask
  const lastPrice = bestBid ?? bestAsk ?? 0

  // midpoint between best bid and ask — the "fair" price
  const markPrice =
    bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : lastPrice

  // if bid is above midpoint the market is leaning bullish → show price in green
  const lastIsUp =
    bestBid != null && bestAsk != null ? bestBid >= markPrice : true

  // derived booleans from display mode
  const showAsks = displayMode === "both" || displayMode === "asks"
  const showBids = displayMode === "both" || displayMode === "bids"

  // scrolls the spread row to the center of the viewport
  function recenter() {
    spreadRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      {/* ── Toolbar ────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-2 py-1.5">
        {/* Display mode icons — clicking one switches what sides are visible */}
        <div className="flex items-center gap-1">
          {(["both", "asks", "bids"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setDisplayMode(mode)}
              className="rounded p-1 hover:bg-muted/40"
              aria-label={`Show ${mode}`}
            >
              <DisplayModeIcon mode={mode} active={displayMode === mode} />
            </button>
          ))}
        </div>

        {/* Price grouping stepper: − [value] + */}
        <div className="flex items-center gap-1 rounded-md bg-surface px-1 py-0.5 text-xs text-muted-foreground">
          {/* − button: move left in GROUPING_STEPS, disabled at index 0 */}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            disabled={stepIdx === 0}
          >
            <Minus className="size-3" />
          </Button>

          {/* current step value */}
          <span className="min-w-8 text-center text-foreground tabular-nums">
            {step}
          </span>

          {/* + button: move right in GROUPING_STEPS, disabled at last index */}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() =>
              setStepIdx((i) => Math.min(GROUPING_STEPS.length - 1, i + 1))
            }
            disabled={stepIdx === GROUPING_STEPS.length - 1}
          >
            <Plus className="size-3" />
          </Button>
        </div>
      </div>

      {/* ── Column headers ─────────────────────────────────────────── */}
      {/* 3-column grid: Price takes remaining space, Size and Total are fixed width */}
      <div className="grid shrink-0 grid-cols-[1fr_4.25rem_4.25rem] px-2 py-1 text-[10px] text-muted-foreground">
        <span>Price (USD)</span>
        <span className="text-right">Size ({baseAsset})</span>
        <span className="text-right">Total ({baseAsset})</span>
      </div>

      {/* ── Scrollable body ────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Asks section — only rendered when displayMode is "both" or "asks" */}
        {showAsks && (
          <div className="flex flex-col">
            {displayAsks.map((level) => (
              <OrderBookRow
                key={`ask-${level.price}`}
                level={level}
                side="ask"
                maxTotal={askMax} // used to size this row's depth bar
                priceDecimals={priceDecimals}
                active={hovered === level.price} // highlight if mouse is here
                onHover={setHovered}
              />
            ))}
          </div>
        )}

        {/* ── Spread row ─────────────────────────────────────────────
            The divider between asks and bids.
            ref={spreadRef} lets recenter() scroll this into view      */}
        <div
          ref={spreadRef}
          className="flex items-center justify-between border-y border-dashed border-border/60 px-2 py-2"
        >
          <div className="flex items-baseline gap-2">
            {/* Last price — green if market leaning up, red if down */}
            <span
              className={cn(
                "text-base font-medium tabular-nums",
                lastIsUp ? "text-green-text" : "text-red-text"
              )}
            >
              {lastPrice.toLocaleString("en-US", { maximumFractionDigits: 1 })}
            </span>

            {/* Mark price (midpoint) shown dimmer next to last price */}
            <span className="text-xs text-muted-foreground tabular-nums">
              {markPrice.toLocaleString("en-US", { maximumFractionDigits: 1 })}
            </span>
          </div>

          {/* Scrolls spread row back to center if user has scrolled away */}
          <button
            type="button"
            onClick={recenter}
            className="text-xs text-blue-text hover:underline"
          >
            Recenter
          </button>
        </div>

        {/* Bids section — only rendered when displayMode is "both" or "bids" */}
        {showBids && (
          <div className="flex flex-col">
            {displayBids.map((level) => (
              <OrderBookRow
                key={`bid-${level.price}`}
                level={level}
                side="bid"
                maxTotal={bidMax} // separate scale from asks
                priceDecimals={priceDecimals}
                active={hovered === level.price}
                onHover={setHovered}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
