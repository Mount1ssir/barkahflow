'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/src/lib/supabase'
import { Lightbulb, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WelcomeHeader } from '@/components/dashboard/welcome-header'
import { Stats } from '@/components/dashboard/stats'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { RadialStockChart } from '@/components/dashboard/radial-stock-chart'
import { TopProducts } from '@/components/dashboard/top-products'
import { SalesDistribution } from '@/components/dashboard/sales-distribution'
import { RecentInvoices } from '@/components/dashboard/recent-invoices'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">

      <WelcomeHeader user={user} />

      <Stats />

      <QuickActions />

      {/* Ligne 1 — Évolution des ventes (Area) + État du stock (Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div className="lg:col-span-1">
          <RadialStockChart />
        </div>
      </div>

      {/* Ligne 2 — Produits les plus vendus (Bar), pleine largeur */}
      <TopProducts />

      {/* Ligne 3 — Répartition des ventes (Pie) + Factures récentes (Table) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesDistribution />
        <RecentInvoices />
      </div>

    </div>
  )
}