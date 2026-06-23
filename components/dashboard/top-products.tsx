'use client'

import { useEffect, useState } from 'react'
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { getTopProducts, type TopProduct } from '@/lib/top-products-data'

// ✅ AJOUT : Imports pour les traductions
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/config'

const GOLD = '#c9a84c'

// ✅ MODIFICATION : Fonction pour créer la config du graphique avec traduction
const useBarConfig = (t: any): ChartConfig => ({
  unitsSold: { label: t('top_products.units_sold', 'Unités vendues'), color: GOLD },
})

export function TopProducts() {
  // ✅ AJOUT : Hook de traduction
  const { t } = useTranslation()
  const barConfig = useBarConfig(t)

  const [products, setProducts] = useState<TopProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTopProducts(5)
      .then(setProducts)
      .finally(() => setLoading(false))
  }, [])

  // Recharts affiche les barres de bas en haut par défaut — on inverse
  // pour que le produit le plus vendu apparaisse en HAUT du graphique
  const chartData = [...products].reverse().map((p) => ({
    name: p.nameAr.length > 14 ? p.nameAr.slice(0, 14) + '…' : p.nameAr,
    unitsSold: p.unitsSold,
  }))

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">
          {t('top_products.title', 'Produits les plus vendus')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <div className="h-16 w-16 rounded-full flex items-center justify-center mb-3 bg-amber-50">
              <Package className="h-7 w-7" style={{ color: GOLD }} />
            </div>
            <p className="text-sm text-muted-foreground">
              {t('top_products.no_sales', 'Aucune vente enregistrée pour le moment')}
            </p>
          </div>
        ) : (
          <ChartContainer config={barConfig} className="h-64 w-full">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 0, right: 16, top: 5, bottom: 5 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tickLine={false} axisLine={false} className="text-xs" />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={100}
                className="text-xs"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) =>
                      `${value} ${t('top_products.units', 'unité(s)')}`
                    }
                  />
                }
              />
              <Bar
                dataKey="unitsSold"
                fill="var(--color-unitsSold)"
                radius={[0, 6, 6, 0]}
                barSize={22}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}