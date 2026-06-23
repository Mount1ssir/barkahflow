'use client'

import { useEffect, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
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

// ✅ Imports pour les traductions
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/config'

type ViewMode = 'ventes' | 'solde'

// ✅ EmptyState utilise useTranslation directement
function EmptyState() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center text-center py-14">
      <div className="h-20 w-20 rounded-full flex items-center justify-center mb-4 bg-amber-50">
        <LineChartIcon className="h-9 w-9" style={{ color: '#c9a84c' }} />
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

export function RevenueChart() {
  const { t } = useTranslation()

  // ✅ Utilisation de t pour la config du graphique
  const chartConfig: ChartConfig = {
    ventes: { label: t('revenue.chart.sales', 'Ventes'), color: '#c9a84c' },
    solde: { label: t('revenue.chart.balance', 'Solde caisse'), color: '#10b981' },
  }

  const [data, setData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<ViewMode>('ventes')
  const [period, setPeriod] = useState<'jours' | 'semaines' | 'mois'>('jours')

  useEffect(() => {
    getRevenueChartData()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  const hasData = data.some((d) => d.ventes > 0 || d.solde !== 0)

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <h3 className="text-base font-semibold text-foreground">
              {t('revenue.title', 'Évolution des ventes')}
            </h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#c9a84c' }} />
                {t('revenue.legend.sales', 'Ventes')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed" style={{ borderColor: '#10b981' }} />
                {t('revenue.legend.balance', 'Solde caisse')}
              </span>
            </div>
          </div>

          <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
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
      </CardHeader>

      <CardContent>
        {loading ? (
          <Skeleton className="h-72 w-full rounded-xl" />
        ) : !hasData ? (
          <EmptyState />
        ) : (
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <AreaChart data={data} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="fillVentes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-ventes)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-ventes)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(v) =>
                      `${Number(v).toFixed(2)} ${t('revenue.currency', 'MAD')}`
                    }
                  />
                }
              />
              <Area
                dataKey={mode}
                type="monotone"
                fill="url(#fillVentes)"
                stroke="var(--color-ventes)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}