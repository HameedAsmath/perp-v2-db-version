"use client"

import { useEffect, useRef, useState } from "react"
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts"
import { cn } from "@/lib/utils"
import { getKlinesApi } from "@/services/orders"
import type { KlineCandle } from "types"

type Props = { symbol?: string }

export function CandlestickChartPanel({ symbol = "BTC-PERP" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null)

  const [candles, setCandles] = useState<KlineCandle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchKlines() {
      try {
        const data = await getKlinesApi(symbol)
        if (cancelled) return
        setCandles(data.candles)
        setError(null)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load chart")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchKlines()
    const id = setInterval(() => void fetchKlines(), 10_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [symbol])

  // Create chart once
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true },
    })

    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#00c279",
      downColor: "#fd4c4d",
      borderUpColor: "#00c279",
      borderDownColor: "#fd4c4d",
      wickUpColor: "#00c279",
      wickDownColor: "#fd4c4d",
    })

    volumeRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    })
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    })

    chartRef.current = chart

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volumeRef.current = null
    }
  }, [])

  // Update series when candles change
  useEffect(() => {
    if (!candleRef.current || !volumeRef.current) return

    candleRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    )

    volumeRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color:
          c.close >= c.open
            ? "rgba(0, 194, 121, 0.45)"
            : "rgba(253, 76, 77, 0.45)",
      }))
    )

    if (candles.length > 0) {
      chartRef.current?.timeScale().fitContent()
    }
  }, [candles])

  const last = candles[candles.length - 1]
  const prev = candles[candles.length - 2]
  const change = last && prev ? last.close - prev.close : 0
  const changePct = prev ? (change / prev.close) * 100 : 0
  const isUp = change >= 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border/60 px-3 py-2 text-xs">
        <span className="text-sm font-medium">{symbol}</span>
        {last && (
          <>
            <span className="text-muted-foreground">
              O{" "}
              <span className="text-foreground tabular-nums">
                {last.open.toFixed(1)}
              </span>
            </span>
            <span className="text-muted-foreground">
              H{" "}
              <span className="text-foreground tabular-nums">
                {last.high.toFixed(1)}
              </span>
            </span>
            <span className="text-muted-foreground">
              L{" "}
              <span className="text-foreground tabular-nums">
                {last.low.toFixed(1)}
              </span>
            </span>
            <span className="text-muted-foreground">
              C{" "}
              <span
                className={cn(
                  "tabular-nums",
                  isUp ? "text-green-text" : "text-red-text"
                )}
              >
                {last.close.toFixed(1)}
              </span>
            </span>
            {prev && (
              <span
                className={cn(
                  "tabular-nums",
                  isUp ? "text-green-text" : "text-red-text"
                )}
              >
                {change >= 0 ? "+" : ""}
                {change.toFixed(1)} ({changePct >= 0 ? "+" : ""}
                {changePct.toFixed(2)}%)
              </span>
            )}
          </>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Loading chart…
          </div>
        )}
        {!loading && candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            No trades yet — place crossing orders to see candles
          </div>
        )}
        {error && (
          <div className="absolute top-3 left-3 text-xs text-red-text">
            {error}
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  )
}
