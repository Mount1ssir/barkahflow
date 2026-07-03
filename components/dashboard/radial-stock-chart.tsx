'use client'

import { useEffect, useState } from 'react'
import { Package } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getStockOverview, type StockOverview } from '@/lib/stock-overview-data'
import { useTranslation } from 'react-i18next'
import { formatMAD } from '@/lib/stats-data'
import '@/lib/i18n/config'

// ─── Couleurs ──────────────────────────────────────────────────────
const BLUE = '#38BDF8'          // Bleu ciel pour le donut
const BLUE_LIGHT = '#E0F2FE'    // Très léger bleu pour le fond (optionnel)
const GRAY_BG = '#E5E7EB'       // Gris clair pour la partie vide

export function RadialStockChart() {
  const { t } = useTranslation()
  const [data, setData] = useState<StockOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStockOverview()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) {
    return (
      <Card className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-500" />
            {t('stock.title', 'État du stock')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Skeleton className="h-56 w-56 rounded-full" />
        </CardContent>
      </Card>
    )
  }

  const total = data.totalProducts
  // Donut : une partie en bleu ciel, le reste en gris
  const chartData = [
    { name: 'stock', value: Math.min(total, 1000), fill: BLUE },
    { name: 'bg', value: Math.max(1000 - total, 0), fill: GRAY_BG },
  ]

  return (
    <Card className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Package className="h-4 w-4 text-gray-500" />
          {t('stock.title', 'État du stock')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center pt-2">
        <div className="relative w-48 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={80}
                startAngle={0}
                endAngle={360}
                paddingAngle={0}
                cornerRadius={8}
                stroke="none"
              >
                {chartData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <Package className="h-5 w-5 text-gray-400 dark:text-gray-500 mb-1" />
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {total}
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('stock.products', 'Produits')}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {t('stock.total', 'au total')}
            </span>
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-3 gap-4 w-full mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              {total}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('stock.products', 'Produits')}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              {data.totalCategories}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('stock.categories', 'Catégories')}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              {formatMAD(data.totalStockValue)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('stock.total_value', 'Valeur du stock')}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}