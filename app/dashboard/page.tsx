'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/src/lib/supabase'
import { WelcomeHeader } from '@/components/dashboard/welcome-header'
import { Stats } from '@/components/dashboard/stats'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { StockStatusChart } from '@/components/dashboard/stock-status-chart'
import { TopProducts } from '@/components/dashboard/top-products'
import { SalesDistribution } from '@/components/dashboard/sales-distribution'
import { RecentInvoices } from '@/components/dashboard/recent-invoices'
import { InsightToast } from '@/components/dashboard/insight-toast'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full relative">
      <InsightToast />
      <WelcomeHeader user={user} />
      <Stats />
      <QuickActions />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div className="lg:col-span-1">
          <StockStatusChart />
        </div>
      </div>

      <TopProducts />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesDistribution />
        <RecentInvoices />
      </div>
    </div>
  )
}