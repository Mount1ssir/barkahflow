'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Package } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { getStockStatus, type StockStatusData } from '@/lib/stock-status-data'
import { formatMAD } from '@/lib/stats-data'

// ─── Couleurs (bleu → cyan → orange) ────────────────────────────
const COLORS = {
  enStock: '#3B82F6',   // Bleu
  stockBas: '#38BDF8',  // Cyan/bleu clair
  rupture: '#F59E0B',   // Orange/ambre
}

const STATUS_LABELS = {
  enStock: 'En stock',
  stockBas: 'Stock bas',
  rupture: 'Rupture',
}

export function StockStatusChart() {
  const { t } = useTranslation()
  const [data, setData] = useState<StockStatusData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStockStatus()
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

  if (data.totalProducts === 0) {
    return (
      <Card className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-500" />
            {t('stock.title', 'État du stock')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-56">
          <Package className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-muted-foreground">
            {t('stock.no_products', 'Aucun produit enregistré')}
          </p>
        </CardContent>
      </Card>
    )
  }

  const total = data.totalProducts

  // Chaque catégorie devient son propre anneau : [valeur pleine couleur, reste couleur pâle]
  const rings = [
    { key: 'enStock', value: data.enStock, color: COLORS.enStock, radius: [82, 92] },
    { key: 'stockBas', value: data.stockBas, color: COLORS.stockBas, radius: [68, 78] },
    { key: 'rupture', value: data.rupture, color: COLORS.rupture, radius: [54, 64] },
  ]

  const legendItems = [
    { key: 'enStock', label: STATUS_LABELS.enStock, count: data.enStock, color: COLORS.enStock },
    { key: 'stockBas', label: STATUS_LABELS.stockBas, count: data.stockBas, color: COLORS.stockBas },
    { key: 'rupture', label: STATUS_LABELS.rupture, count: data.rupture, color: COLORS.rupture },
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
        <div className="relative w-56 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {rings.map((ring) => {
                if (ring.value === 0) return null
                const ringData = [
                  { name: ring.key, value: ring.value },
                  { name: 'rest', value: total - ring.value },
                ]
                return (
                  <Pie
                    key={ring.key}
                    data={ringData}
                    dataKey="value"
                    nameKey="name"
                    startAngle={90}
                    endAngle={450}
                    innerRadius={ring.radius[0]}
                    outerRadius={ring.radius[1]}
                    paddingAngle={2}
                    cornerRadius={10}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    <Cell fill={ring.color} />
                    <Cell fill={ring.color} fillOpacity={0.15} />
                  </Pie>
                )
              })}
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {data.totalProducts}
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('stock.products', 'Produits')}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {t('stock.total', 'au total')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 mt-4 flex-wrap justify-center">
          {legendItems.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <div
                className="w-1 h-6 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {item.count}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {item.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 w-full mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              {data.totalProducts}
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