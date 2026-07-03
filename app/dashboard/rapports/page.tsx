'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMAD } from '@/lib/stats-data'
import {
  getDailySales,
  getWeeklySales,
  getMonthlySales,
  getTopProducts,
  getSalesByCategory,
  type SalesStats,
  type TopProduct,
  type CategoryStat,
} from '@/lib/report-data'

const GOLD = '#D4A017'

export default function ReportsPage() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [salesStats, setSalesStats] = useState<SalesStats | null>(null)
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [period])

  const loadData = async () => {
    setLoading(true)
    try {
      let stats: SalesStats
      if (period === 'daily') stats = await getDailySales()
      else if (period === 'weekly') stats = await getWeeklySales()
      else stats = await getMonthlySales()

      const [products, categories] = await Promise.all([
        getTopProducts(5),
        getSalesByCategory(),
      ])
      setSalesStats(stats)
      setTopProducts(products)
      setCategoryStats(categories)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          {t('reports.title', 'Rapports')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-gray-400">
          {t('reports.subtitle', 'Statistiques et analyses de vos ventes')}
        </p>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="sales">{t('reports.sales', 'Ventes')}</TabsTrigger>
          <TabsTrigger value="products">{t('reports.products', 'Produits')}</TabsTrigger>
          <TabsTrigger value="categories">{t('reports.categories', 'Catégories')}</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <div className="flex flex-wrap gap-4 mb-4">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as 'daily' | 'weekly' | 'monthly')}>
              <TabsList>
                <TabsTrigger value="daily">{t('reports.daily', 'Aujourd\'hui')}</TabsTrigger>
                <TabsTrigger value="weekly">{t('reports.weekly', 'Cette semaine')}</TabsTrigger>
                <TabsTrigger value="monthly">{t('reports.monthly', 'Ce mois')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t('reports.total_sales', 'Total des ventes')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <p className="text-2xl font-bold" style={{ color: GOLD }}>
                    {formatMAD(salesStats?.total || 0)}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t('reports.invoice_count', 'Nombre de factures')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{salesStats?.count || 0}</p>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t('reports.average_ticket', 'Panier moyen')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <p className="text-2xl font-bold" style={{ color: GOLD }}>
                    {formatMAD(salesStats?.average || 0)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>{t('reports.top_products', 'Meilleurs produits')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : topProducts.length === 0 ? (
                <p className="text-sm text-slate-500">{t('reports.no_data', 'Aucune donnée')}</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-400">#{i + 1}</span>
                        <span className="font-medium">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-500">{p.quantity} {t('reports.units', 'unités')}</span>
                        <span className="font-bold" style={{ color: GOLD }}>{formatMAD(p.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>{t('reports.sales_by_category', 'Ventes par catégorie')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : categoryStats.length === 0 ? (
                <p className="text-sm text-slate-500">{t('reports.no_data', 'Aucune donnée')}</p>
              ) : (
                <div className="space-y-3">
                  {categoryStats.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between">
                      <span className="font-medium">{cat.name}</span>
                      <span className="font-bold" style={{ color: GOLD }}>{cat.value}%</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}