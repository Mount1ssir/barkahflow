'use client'

import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { ArrowLeft, Download, TrendingUp, ShoppingBag, Award } from 'lucide-react'

export default function SalesReportsPage() {
  const { t } = useTranslation()

  // Realistic Dummy Data
  const productsPerformance = [
    { name: 'Premium Olive Oil 1L', sku: 'SKU-OLV-01', qty: 340, total: 3400000 }, // in centimes
    { name: 'Moroccan Mint Tea Pack', sku: 'SKU-TEA-05', qty: 850, total: 1275000 },
    { name: 'Organic Argan Cosmetics', sku: 'SKU-ARG-12', qty: 112, total: 4480000 },
    { name: 'Pure Saffron 5g', sku: 'SKU-SAF-02', qty: 68, total: 3390000 }
  ]

  const formatMAD = (centimes: number) => {
    return 'MAD ' + (centimes / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
              {t('reports.sales.title', 'Sales Reports')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {t('reports.sales.subtitle', 'Monitor revenue numbers, orders, and individual product sell-throughs')}
            </p>
          </div>
        </div>

        <button 
          onClick={() => alert('Sales Report Exported Successfully!')}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors duration-150 shadow-sm cursor-pointer"
        >
          <Download size={15} />
          <span>{t('reports.export', 'Export')}</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Revenue */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              {t('reports.sales.total_revenue', 'Total Revenue')}
            </span>
            <span className="text-3xl font-bold text-emerald-800 dark:text-emerald-455 mt-1">
              {formatMAD(12545000)} {/* 125,450.00 MAD */}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-500 font-medium mt-1">
              +14.2% {t('reports.sales.vs_last_month', 'vs last month')}
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
              {t('reports.sales.aov', 'Average Order Value')}
            </span>
            <span className="text-3xl font-bold text-slate-800 dark:text-zinc-200 mt-1">
              {formatMAD(32050)} {/* 320.50 MAD */}
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {t('reports.sales.based_on_orders', 'Based on 391 orders')}
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
            {t('reports.sales.performance_title', 'Product Performance')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-950/40 border-b border-slate-200 dark:border-zinc-800">
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider">{t('reports.sales.item_name', 'Item Name')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-40">{t('reports.sales.sku', 'SKU')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-center w-32">{t('reports.sales.qty_sold', 'Qty Sold')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-right w-44">{t('reports.sales.total_sales', 'Total Sales')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
              {productsPerformance.map((product, idx) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
