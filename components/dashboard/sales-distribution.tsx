'use client'

import { useEffect, useState } from 'react'
import { Pie, PieChart, Cell } from 'recharts'
import { Calendar } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { getSalesDistribution, type SalesSlice } from '@/lib/sales-distribution-data'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/config'

type Period = 'today' | 'week' | 'month'

const periodLabels: Record<Period, string> = {
  today: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
}

export function SalesDistribution() {
  const { t } = useTranslation()
  const [data, setData] = useState<SalesSlice[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('week')

  useEffect(() => {
    loadData()
  }, [period])

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await getSalesDistribution(period)
      setData(result)
    } catch (error) {
      console.error('Erreur chargement répartition:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredData = data.filter(slice => slice.name && slice.name.trim() !== '')

  const chartConfig = filteredData.reduce((acc, d) => {
    acc[d.name] = { label: d.name, color: d.color }
    return acc
  }, {} as Record<string, { label: string; color: string }>)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
          {t('sales.by_category', 'Répartition des ventes')}
        </CardTitle>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[160px] h-8 rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs">
            <Calendar className="mr-2 h-3.5 w-3.5 text-gray-400" />
            <SelectValue placeholder={t('sales.period', 'Période')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{periodLabels.today}</SelectItem>
            <SelectItem value="week">{periodLabels.week}</SelectItem>
            <SelectItem value="month">{periodLabels.month}</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent>
        {loading ? (
          <Skeleton className="h-48 w-full rounded-full" />
        ) : filteredData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            {t('common.no_data', 'Aucune donnée disponible')}
          </p>
        ) : (
          <div className="flex items-center gap-4">
            <ChartContainer config={chartConfig} className="h-40 w-40 shrink-0">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie data={filteredData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70}>
                  {filteredData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="flex flex-col gap-1.5 flex-1">
              {filteredData.map((slice) => (
                <div key={slice.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
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