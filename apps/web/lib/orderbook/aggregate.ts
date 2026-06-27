import type { OrderBookPriceLevel, RestingOrder } from "types"

/** Book side for aggregation (maps to bids = long, asks = short). */
export type BookSide = "bid" | "ask"

/**
 * Step 1 — Aggregate: multiple orders at the same price → one row with summed quantity.
 * Bids stay high→low; asks stay low→high (best price first).
 */
export function aggregateLevels(
  orders: Pick<RestingOrder, "price" | "quantity">[],
  side: BookSide
): { price: number; size: number }[] {
  const byPrice = new Map<number, number>()
  for (const o of orders) {
    byPrice.set(o.price, (byPrice.get(o.price) ?? 0) + o.quantity)
  }
  const levels = [...byPrice.entries()].map(([price, size]) => ({
    price,
    size,
  }))
  return side === "bid"
    ? levels.sort((a, b) => b.price - a.price)
    : levels.sort((a, b) => a.price - b.price)
}

/**
 * Step 2 — Grouping: bucket prices to the precision stepper (0.1, 1, 10, …).
 * Bids floor down; asks ceil up so levels stay on the conservative side.
 */
export function applyPriceGrouping(
  levels: { price: number; size: number }[],
  step: number,
  side: BookSide
): { price: number; size: number }[] {
  if (step <= 0) return levels

  const byBucket = new Map<number, number>()
  for (const l of levels) {
    const bucket =
      side === "bid"
        ? Math.floor(l.price / step) * step
        : Math.ceil(l.price / step) * step
    const key = Math.round(bucket / step) * step
    byBucket.set(key, (byBucket.get(key) ?? 0) + l.size)
  }

  const grouped = [...byBucket.entries()].map(([price, size]) => ({
    price,
    size,
  }))
  return side === "bid"
    ? grouped.sort((a, b) => b.price - a.price)
    : grouped.sort((a, b) => a.price - b.price)
}

/**
 * Step 3 — Cumulative total: walk from BEST price outward.
 * Input must be sorted best-first (bids high→low, asks low→high).
 * Best level total = its own size; each worse level adds to the running sum.
 */
export function computeCumulativeTotals(
  levels: { price: number; size: number }[]
): OrderBookPriceLevel[] {
  let running = 0
  return levels.map((level) => {
    running += level.size
    return { price: level.price, size: level.size, total: running }
  })
}

/** Full pipeline: aggregate → group by step → cumulative totals. */
export function prepareSideLevels(
  orders: RestingOrder[],
  side: BookSide,
  groupingStep: number
): OrderBookPriceLevel[] {
  const aggregated = aggregateLevels(orders, side)
  const grouped = applyPriceGrouping(aggregated, groupingStep, side)
  return computeCumulativeTotals(grouped)
}

/**
 * Display order: asks reversed so worst is at top, best sits just above spread.
 * Bids: best first just below spread (same order as engine sort).
 */
export function levelsForDisplay(
  levels: OrderBookPriceLevel[],
  side: BookSide
): OrderBookPriceLevel[] {
  return side === "ask" ? [...levels].reverse() : levels
}

/** Max cumulative total on this side (for depth bar width). */
export function rawMaxTotal(levels: OrderBookPriceLevel[]): number {
  return levels.length ? Math.max(...levels.map((l) => l.total)) : 0
}

/**
 * Depth bar max: per side only (not shared across bids/asks).
 * Smooth so bars don't jitter when book updates: grow instantly, decay slowly (×0.9).
 */
export function smoothMaxTotal(rawMax: number, prevMax: number): number {
  if (rawMax === 0) return 0
  return Math.max(rawMax, prevMax * 0.9)
}

export function formatPrice(price: number, decimals: number): string {
  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatSize(size: number): string {
  return size.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  })
}

export function priceDecimalsForStep(step: number): number {
  if (step >= 1) return 0
  const s = step.toString()
  const dot = s.indexOf(".")
  return dot === -1 ? 0 : s.length - dot - 1
}

export const GROUPING_STEPS = [0.1, 1, 10, 100, 1000] as const
