'use client'

import { useEffect, useState } from 'react'
import { Label, Pie, PieChart } from 'recharts'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { getStockOverview, type StockOverview } from '@/lib/stock-overview-data'

// ✅ AJOUT : Imports pour les traductions
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/config'

// ✅ MODIFICATION : Utilisation des traductions pour les libellés
const useChartConfig = (t: any): ChartConfig => ({
  okStock: { label: t('stock.chart.ok', 'En stock'), color: '#10b981' },
  lowStock: { label: t('stock.chart.low', 'Stock bas'), color: '#f59e0b' },
  outOfStock: { label: t('stock.chart.out', 'Rupture'), color: '#ef4444' },
})

export function RadialStockChart() {
  // ✅ AJOUT : Hook de traduction
  const { t } = useTranslation()
  const chartConfig = useChartConfig(t)

  const [data, setData] = useState<StockOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStockOverview()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  const chartData = data
    ? [
        { name: 'okStock', value: data.okStock, fill: '#10b981' },
        { name: 'lowStock', value: data.lowStock, fill: '#f59e0b' },
        { name: 'outOfStock', value: data.outOfStock, fill: '#ef4444' },
      ]
    : []

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">{t('stock.title', 'État du stock')}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center">
        {loading ? (
          <Skeleton className="h-56 w-56 rounded-full" />
        ) : !data || data.totalProducts === 0 ? (
          <p className="text-sm text-muted-foreground py-10">
            {t('stock.no_products', 'Aucun produit enregistré')}
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-56 w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={85}
                strokeWidth={4}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                            {data.totalProducts}
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-xs">
                            {t('stock.products', 'Produits')}
                          </tspan>
                        </text>
                      )
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}