"use client"

import { useAuth } from "@/contexts/auth-provider"
import { OrderForm } from "@/components/orderbook/order-form"
import { OrderBookPanel } from "@/components/orderbook/order-book-panel"
import { CandlestickChartPanel } from "@/components/chart/candlestick-chart"
import { FooterTabs } from "@/components/footer/footer-tabs"

export default function TradingLayoutShell() {
  const { signOut } = useAuth()
  return (
    <div className="flex flex-col overflow-y-auto">
      <div className="flex h-auto shrink-0 items-center gap-6 overflow-x-auto border-b border-zinc-800 px-4 py-3 sm:gap-8">
        Market Info Bar
        <button onClick={signOut}>Logout</button>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="flex min-h-[420px] flex-1 flex-col border-b border-zinc-800 lg:min-h-0 lg:border-r lg:border-b-0">
          <CandlestickChartPanel symbol="BTC-PERP" />
        </div>

        <div className="margin flex h-64 w-full shrink-0 flex-col overflow-y-auto border-b border-zinc-800 lg:h-auto lg:w-72 lg:border-r lg:border-b-0">
          <OrderBookPanel symbol="BTC-PERP" />
        </div>

        <div className="flex w-full shrink-0 flex-col overflow-y-auto bg-background p-4 lg:w-96">
          <OrderForm />
        </div>
      </div>

      <div className="flex h-60 shrink-0 items-center gap-6 overflow-x-auto border-t border-zinc-800 px-4">
        <FooterTabs />
      </div>
    </div>
  )
}
