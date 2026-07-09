'use client'

import { useEffect, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Line } from 'recharts'
import { LineChart as LineChartIcon, ShoppingCart } from 'lucide-react'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getRevenueChartData, type ChartDataPoint } from '@/lib/revenue-chart-data'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/config'

type ViewMode = 'ventes' | 'solde'
type Period = 'jours' | 'semaines' | 'mois'

const BLUE = '#38BDF8'
const ORANGE = '#F59E0B'

function EmptyState() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center text-center py-14">
      <div className="h-20 w-20 rounded-full flex items-center justify-center mb-4 bg-blue-50">
        <LineChartIcon className="h-9 w-9" style={{ color: BLUE }} />
      </div>
      <h4 className="text-base font-semibold text-foreground mb-1">
        {t('revenue.empty.title', 'Aucune donnée pour le moment')}
      </h4>
      <p className="text-sm text-muted-foreground mb-5 max-w-xs">
        {t('revenue.empty.description', 'Commencez par ajouter une vente pour voir vos statistiques ici.')}
      </p>
      <Button
        className="gap-2 rounded-xl"
        style={{ backgroundColor: '#10b981' }}
        onClick={() => (window.location.href = '/dashboard/caisse')}
      >
        <ShoppingCart size={16} />
        {t('revenue.empty.cta', 'Créer une vente')}
      </Button>
    </div>
  )
}

function Insight({ currentTotal, previousTotal }: { currentTotal: number; previousTotal: number }) {
  const { t } = useTranslation()
  const diff = currentTotal - previousTotal
  const pct = previousTotal === 0 ? null : Math.round((diff / previousTotal) * 100)

  if (pct === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="text-yellow-500 text-lg">💡</span>
        {t('revenue.insight.first_period', 'Première période – les données commencent à se construire.')}
      </div>
    )
  }

  const isPositive = diff >= 0
  const emoji = isPositive ? '📈' : '📉'
  const message = isPositive
    ? t('revenue.insight.up', 'En hausse de {{pct}}% par rapport à la période précédente.', { pct })
    : t('revenue.insight.down', 'En baisse de {{pct}}% par rapport à la période précédente.', { pct: Math.abs(pct) })

  return (
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <span className="text-lg">{emoji}</span>
      <span>{message}</span>
    </div>
  )
}

export function RevenueChart() {
  const { t } = useTranslation()

  const chartConfig: ChartConfig = {
    ventes: { label: t('revenue.chart.sales', 'Ventes'), color: BLUE },
    solde: { label: t('revenue.chart.balance', 'Solde caisse'), color: '#10b981' },
    previous: { label: t('revenue.chart.previous', 'Période précédente'), color: ORANGE },
  }

  const [currentData, setCurrentData] = useState<ChartDataPoint[]>([])
  const [previousData, setPreviousData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<ViewMode>('ventes')
  const [period, setPeriod] = useState<Period>('jours')

  useEffect(() => {
    loadData()
  }, [period])

  const loadData = async () => {
    setLoading(true)
    try {
      let days = 7
      let offset = 7
      let groupBy: 'day' | 'week' | 'month' = 'day'

      if (period === 'semaines') {
        days = 28
        offset = 28
        groupBy = 'week'
      } else if (period === 'mois') {
        days = 90
        offset = 90
        groupBy = 'month'
      }

      const current = await getRevenueChartData(0, days, groupBy)
      setCurrentData(current)

      const previous = await getRevenueChartData(offset, days, groupBy)
      setPreviousData(previous)
    } catch (error) {
      console.error('Erreur chargement données', error)
    } finally {
      setLoading(false)
    }
  }

  const mergedData = currentData.map((point, index) => ({
    ...point,
    previousSales: previousData[index]?.ventes ?? 0,
  }))

  const hasData = currentData.some(d => d.ventes > 0 || d.solde !== 0)
  const currentTotal = currentData.reduce((acc, d) => acc + d.ventes, 0)
  const previousTotal = previousData.reduce((acc, d) => acc + d.ventes, 0)

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <h3 className="text-base font-semibold text-foreground">
                {t('revenue.title', 'Évolution des ventes')}
              </h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BLUE }} />
                  {t('revenue.legend.sales', 'Ventes')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t border-dashed" style={{ borderColor: ORANGE }} />
                  {t('revenue.legend.previous', 'Période précédente')}
                </span>
              </div>
            </div>

            <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <TabsList className="rounded-lg">
                <TabsTrigger value="jours" className="text-xs">
                  {t('revenue.tabs.days', 'Jours')}
                </TabsTrigger>
                <TabsTrigger value="semaines" className="text-xs">
                  {t('revenue.tabs.weeks', 'Semaines')}
                </TabsTrigger>
                <TabsTrigger value="mois" className="text-xs">
                  {t('revenue.tabs.months', 'Mois')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {!loading && hasData && (
            <Insight currentTotal={currentTotal} previousTotal={previousTotal} />
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <Skeleton className="h-72 w-full rounded-xl" />
        ) : !hasData ? (
          <EmptyState />
        ) : (
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <AreaChart data={mergedData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="fillVentes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BLUE} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs"
                // Pour les mois, afficher le nom complet ; pour semaines, date courte
                interval={0}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(v, name) => {
                      if (name === 'previousSales') {
                        return [`${Number(v).toFixed(2)} MAD`, 'Période précédente']
                      }
                      return `${Number(v).toFixed(2)} MAD`
                    }}
                  />
                }
              />
              <Area
                dataKey={mode}
                type="monotone"
                fill="url(#fillVentes)"
                stroke={BLUE}
                strokeWidth={2}
              />
              <Line
                dataKey="previousSales"
                type="monotone"
                stroke={ORANGE}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}