'use client'

import { useEffect, useState } from 'react'
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Package, Calendar } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getTopProducts, type TopProduct } from '@/lib/top-products-data'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/config'

// ─── Couleurs ──────────────────────────────────────────────────────
const BLUE_DARK = '#0EA5E9'

type Period = 'today' | 'week' | 'month'

const periodLabels: Record<Period, string> = {
  today: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
}

export function TopProducts() {
  const { t } = useTranslation()
  const [products, setProducts] = useState<TopProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('week')

  useEffect(() => {
    loadProducts()
  }, [period])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const data = await getTopProducts(5, period)
      setProducts(data)
    } catch (error) {
      console.error('Erreur chargement produits:', error)
    } finally {
      setLoading(false)
    }
  }

  // On inverse pour que le plus vendu soit en haut
  const chartData = [...products].reverse().map((p) => ({
    name: p.nameAr.length > 14 ? p.nameAr.slice(0, 14) + '…' : p.nameAr,
    unitsSold: p.unitsSold,
    totalAmount: p.totalAmount,
  }))

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white dark:bg-gray-900 p-3 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800">
          <p className="text-sm font-bold text-gray-900 dark:text-white">{data.name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('top_products.units_sold')}: <span className="font-bold">{data.unitsSold}</span>
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            CA: <span className="font-bold" style={{ color: BLUE_DARK }}>{(data.totalAmount / 100).toFixed(2)} MAD</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
          {t('top_products.title', 'Produits les plus vendus')}
        </CardTitle>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[160px] h-8 rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs">
            <Calendar className="mr-2 h-3.5 w-3.5 text-gray-400" />
            <SelectValue placeholder={t('top_products.period', 'Période')} />
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
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <Package className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-muted-foreground">
              {t('top_products.no_sales', 'Aucune vente enregistrée pour le moment')}
            </p>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 0, right: 16, top: 5, bottom: 5 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
                <XAxis type="number" tickLine={false} axisLine={false} className="text-xs fill-gray-500" />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  width={100}
                  className="text-xs fill-gray-500"
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="unitsSold" radius={[0, 6, 6, 0]} barSize={20} fill={BLUE_DARK} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}