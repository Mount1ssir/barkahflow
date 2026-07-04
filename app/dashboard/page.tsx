'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/src/lib/supabase'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const goToSettings = () => {
    router.push('/dashboard/settings')
  }

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

      {/* ─── BOUTON PARAMÈTRES FLOTTANT EN BAS À GAUCHE ─── */}
      {/* Bleu marine (#1E293B) - visible en dark mode */}
      <div className="fixed bottom-8 left-24 z-50">
        <Button
          onClick={goToSettings}
          className="w-12 h-12 rounded-full shadow-lg border-0 flex items-center justify-center hover:shadow-xl transition-all duration-200 group"
          style={{ backgroundColor: '#1E293B' }}
          aria-label="Paramètres"
        >
          <Settings
            size={22}
            className="text-white group-hover:text-blue-300 transition-colors"
            style={{ animation: 'spin 6s linear infinite' }}
          />
        </Button>
        {/* Le texte "Paramètres" est supprimé */}
      </div>

      {/* ─── Animation CSS ─── */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}