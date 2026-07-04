'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Package, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

interface ProductStats {
  total: number
  active: number
  lowStock: number
  outOfStock: number
}

async function getProductStats(): Promise<ProductStats> {
  const { dbSelect } = await import('@/src/lib/db')
  
  const rows = await dbSelect<{ status: string; count: number }>(
    `SELECT 
       CASE 
         WHEN p.is_active = 0 THEN 'inactive'
         WHEN p.stock_qty <= 0 THEN 'out_of_stock'
         WHEN p.stock_qty <= p.alert_threshold THEN 'low_stock'
         ELSE 'active'
       END as status,
       COUNT(*) as count
     FROM products p
     GROUP BY status`
  )

  let total = 0
  let active = 0
  let lowStock = 0
  let outOfStock = 0

  for (const row of rows) {
    const count = Number(row.count)
    total += count
    if (row.status === 'active') active += count
    else if (row.status === 'low_stock') lowStock += count
    else if (row.status === 'out_of_stock') outOfStock += count
  }

  return { total, active, lowStock, outOfStock }
}

export function ProductsOverviewBar() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<ProductStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProductStats()
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  if (loading || !stats) {
    return (
      <div className="flex items-center gap-8 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="animate-pulse flex gap-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div>
                <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const items = [
    {
      key: 'total',
      label: t('products.stats.total', 'Products'),
      value: stats.total,
      icon: Package,
      color: '#3B82F6',
      bg: 'rgba(59,130,246,0.10)',
    },
    {
      key: 'active',
      label: t('products.stats.active', 'Active'),
      value: stats.active,
      icon: CheckCircle,
      color: '#22C55E',
      bg: 'rgba(34,197,94,0.10)',
    },
    {
      key: 'lowStock',
      label: t('products.stats.low_stock', 'Low Stock'),
      value: stats.lowStock,
      icon: AlertTriangle,
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.10)',
    },
    {
      key: 'outOfStock',
      label: t('products.stats.out_of_stock', 'Out of Stock'),
      value: stats.outOfStock,
      icon: XCircle,
      color: '#EF4444',
      bg: 'rgba(239,68,68,0.10)',
    },
  ]

  return (
    <div className="flex flex-wrap items-center gap-6 md:gap-10 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div key={item.key} className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: item.bg }}
            >
              <Icon size={18} style={{ color: item.color }} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                {item.value}
              </p>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 leading-tight">
                {item.label}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}