'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { ArrowLeft, Download, TrendingUp, ShoppingBag, Award } from 'lucide-react'
import { fetchSalesReportData, SalesReportStats } from '@/lib/expenses-data'

export default function SalesReportsPage() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<SalesReportStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSalesReportData().then(data => {
      setStats(data)
      setLoading(false)
    })
  }, [])

  const productsPerformance = stats?.products || []
  const totalRevenue = stats?.totalRevenue || 0
  const avgOrderValue = stats?.avgOrderValue || 0
  const orderCount = stats?.orderCount || 0

  const formatMAD = (centimes: number) => {
    return 'MAD ' + (centimes / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const handleExport = () => {
    const csvContent = [
      ['Nom du produit', 'SKU', 'Quantité vendue', 'Ventes totales (MAD)'],
      ...productsPerformance.map(p => [
        p.name,
        p.sku,
        p.qty,
        (p.total / 100).toFixed(2)
      ])
    ]
      .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'rapport_ventes.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full p-1 bg-slate-50/50 dark:bg-transparent min-h-screen">
      {/* Breadcrumb / Back Button & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link 
            href="/dashboard/rapports"
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-850 rounded-lg transition-colors duration-150 cursor-pointer"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {t('reports.sales.title', 'Rapports de ventes')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {t('reports.sales.subtitle', 'Suivez les chiffres d\'affaires, les commandes et l\'écoulement des produits individuellement')}
            </p>
          </div>
        </div>

        <button 
          onClick={handleExport}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors duration-150 shadow-sm cursor-pointer"
        >
          <Download size={15} />
          <span>{t('reports.export', 'Exporter')}</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Revenue */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              {t('reports.sales.total_revenue', 'Revenu total')}
            </span>
            <span className="text-3xl font-bold text-emerald-800 dark:text-emerald-455 mt-1">
              {formatMAD(totalRevenue)}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-500 font-medium mt-1">
              Chiffre d'affaires global enregistré
            </span>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Average Order Value */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              {t('reports.sales.aov', 'Valeur moyenne des commandes')}
            </span>
            <span className="text-3xl font-bold text-slate-800 dark:text-zinc-200 mt-1">
              {formatMAD(avgOrderValue)}
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {t('reports.sales.based_on_orders', 'Basé sur {{count}} commandes', { count: orderCount })}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
            <ShoppingBag size={24} />
          </div>
        </div>
      </div>

      {/* Product Performance Table Container */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
          <Award size={18} className="text-emerald-600" />
          <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            {t('reports.sales.performance_title', 'Performance des produits')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-950/40 border-b border-slate-200 dark:border-zinc-800">
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider">{t('reports.sales.item_name', 'Nom du produit')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-40">{t('reports.sales.sku', 'SKU')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-center w-32">{t('reports.sales.qty_sold', 'Quantité vendue')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-right w-44">{t('reports.sales.total_sales', 'Ventes totales')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-xs text-slate-400">
                    Chargement des données de ventes...
                  </td>
                </tr>
              ) : productsPerformance.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-xs text-slate-400">
                    Aucune vente enregistrée.
                  </td>
                </tr>
              ) : (
                productsPerformance.map((product, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/30 dark:hover:bg-zinc-850/40 transition-colors duration-150">
                    <td className="px-6 py-4 text-xs font-semibold text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-zinc-400 whitespace-nowrap font-mono">
                      {product.sku}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-800 dark:text-zinc-200 text-center font-medium whitespace-nowrap">
                      {product.qty}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-emerald-800 dark:text-emerald-450 text-right whitespace-nowrap">
                      {formatMAD(product.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
