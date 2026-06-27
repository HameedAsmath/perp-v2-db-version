"use client"

import { cn } from "@/lib/utils"
import type { OrderBookPriceLevel } from "types"
import { formatPrice, formatSize } from "@/lib/orderbook/aggregate"

type OrderBookRowProps = {
  level: OrderBookPriceLevel
  side: "bid" | "ask"
  maxTotal: number
  priceDecimals: number
  active: boolean
  onHover: (price: number | null) => void
}

export function OrderBookRow({
  level,
  side,
  maxTotal,
  priceDecimals,
  active,
  onHover,
}: OrderBookRowProps) {
  const isBid = side === "bid"
  const barPct = maxTotal > 0 ? (level.total / maxTotal) * 100 : 0
  const tipFrac = level.total > 0 ? level.size / level.total : 0
  const color = isBid ? "var(--green)" : "var(--red)"

  return (
    <button
      type="button"
      className={cn(
        "relative grid w-full grid-cols-[1fr_4.25rem_4.25rem] items-center px-2 py-[2px] text-xs",
        "hover:bg-muted/30",
        active && "bg-muted/40"
      )}
      onMouseEnter={() => onHover(level.price)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Depth bar: anchored right, grows left; dark base + bright tip at leading edge */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 transition-[width] duration-300 ease-out"
        style={{ width: `${barPct}%` }}
      >
        <div
          className="absolute inset-0"
          style={{ backgroundColor: color, opacity: 0.12 }}
        />
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-300 ease-out"
          style={{
            width: `${tipFrac * 100}%`,
            backgroundColor: color,
            opacity: 0.28,
          }}
        />
      </div>

      <span
        className={cn(
          "relative z-10 tabular-nums",
          isBid ? "text-green-text" : "text-red-text"
        )}
      >
        {formatPrice(level.price, priceDecimals)}
      </span>
      <span className="relative z-10 text-right text-foreground/90 tabular-nums">
        {formatSize(level.size)}
      </span>
      <span className="relative z-10 text-right text-muted-foreground tabular-nums">
        {formatSize(level.total)}
      </span>
    </button>
  )
}
