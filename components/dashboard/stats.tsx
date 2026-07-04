'use client'

import { useEffect, useState } from 'react'
import { Minus, TrendingUp, TrendingDown, LineChart, ShoppingCart, Package, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getDashboardStats, formatMAD, type DashboardStats } from '@/lib/stats-data'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/config'

type TranslateFn = (key: string, defaultValue?: string) => string

function StatCardSkeleton() {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5">
        <Skeleton className="h-12 w-12 rounded-xl mb-4" />
        <Skeleton className="h-3 w-24 mb-2" />
        <Skeleton className="h-7 w-28" />
      </CardContent>
    </Card>
  )
}

interface StatCardProps {
  label: string
  value: string
  changePct: number
  icon: React.ReactNode
  iconBg: string
  t: any
}

function StatCard({ label, value, changePct, icon, iconBg, t }: StatCardProps) {
  const isZero = changePct === 0
  const isPositive = changePct > 0

  return (
    <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-5">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${iconBg}`}>
          {icon}
        </div>
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground mb-2">{value}</p>
        <div className="flex items-center gap-1 text-xs">
          {isZero ? (
            <Minus size={12} className="text-muted-foreground" />
          ) : isPositive ? (
            <TrendingUp size={12} style={{ color: '#10b981' }} />
          ) : (
            <TrendingDown size={12} style={{ color: '#ef4444' }} />
          )}
          <span
            className="font-medium"
            style={{ color: isZero ? '#9ca3af' : isPositive ? '#10b981' : '#ef4444' }}
          >
            {isZero ? '0%' : `${isPositive ? '+' : ''}${changePct.toFixed(0)}%`}
          </span>
          <span className="text-muted-foreground">{t('dashboard.stats.vs_yesterday', 'vs hier')}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function Stats() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* ✅ Label remplacé par "Encaissé aujourd'hui" */}
      <StatCard
        label={t('dashboard.stats.revenue', 'Encaissé aujourd\'hui')}
        value={formatMAD(stats.todayRevenue)}
        changePct={stats.todayRevenueChange}
        icon={<LineChart className="h-6 w-6 text-green-600" />}
        iconBg="bg-green-50"
        t={t}
      />
      <StatCard
        label={t('dashboard.stats.sales', 'Ventes')}
        value={String(stats.totalSales)}
        changePct={0}
        icon={<ShoppingCart className="h-6 w-6 text-violet-600" />}
        iconBg="bg-violet-50"
        t={t}
      />
      <StatCard
        label={t('dashboard.stats.in_stock', 'Produits en stock')}
        value={String(stats.totalProducts)}
        changePct={0}
        icon={<Package className="h-6 w-6 text-orange-600" />}
        iconBg="bg-orange-50"
        t={t}
      />
      <StatCard
        label={t('dashboard.stats.clients', 'Clients')}
        value={String(stats.totalClients)}
        changePct={0}
        icon={<Users className="h-6 w-6 text-blue-600" />}
        iconBg="bg-blue-50"
        t={t}
      />
    </div>
  )
}