// components/dashboard/sales-distribution.tsx
'use client'

import { useEffect, useState } from 'react'
import { Pie, PieChart, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { getSalesDistribution, type SalesSlice } from '@/lib/sales-distribution-data'

// ✅ AJOUT : Imports pour les traductions
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/config'

// Dégradé de tons or, du plus foncé au plus clair — palette homogène
const GOLD_SHADES = ['#b8932a', '#d4af6a', '#e2c285', '#efd6a8', '#f5e6c8']

export function SalesDistribution() {
  // ✅ AJOUT : Hook de traduction
  const { t } = useTranslation()

  const [data, setData] = useState<SalesSlice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSalesDistribution()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  const chartConfig = data.reduce((acc, d, i) => {
    acc[d.name] = { label: d.name, color: GOLD_SHADES[i % GOLD_SHADES.length] }
    return acc
  }, {} as Record<string, { label: string; color: string }>)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('sales.by_category', 'Répartition des ventes')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-48 w-full rounded-full" />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            {t('common.no_data', 'Aucune donnée disponible')}
          </p>
        ) : (
          <div className="flex items-center gap-4">
            <ChartContainer config={chartConfig} className="h-40 w-40 shrink-0">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70}>
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={GOLD_SHADES[index % GOLD_SHADES.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="flex flex-col gap-1.5 flex-1">
              {data.map((slice, index) => (
                <div key={slice.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: GOLD_SHADES[index % GOLD_SHADES.length] }}
                    />
                    <span className="truncate text-muted-foreground">{slice.name}</span>
                  </div>
                  <span className="font-medium text-foreground shrink-0 ml-2">{slice.value}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}