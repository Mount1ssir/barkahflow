'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { ArrowLeft, Download, Percent, Landmark, Receipt, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { fetchBusinessReportData, BusinessReportStats } from '@/lib/expenses-data'

export default function BusinessReportsPage() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<BusinessReportStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBusinessReportData().then(data => {
      setStats(data)
      setLoading(false)
    })
  }, [])

  const ledgerEntries = stats?.ledger || []
  const profitMargin = stats?.profitMargin || 0
  const totalExpenses = stats?.totalExpenses || 0
  const expenseCount = stats?.expenseCount || 0

  const formatMAD = (centimes: number) => {
    return 'MAD ' + (centimes / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const translateCategory = (cat: string) => {
    if (!cat) return ''
    if (cat === 'invoice') return t('reports.business.sales_revenue', 'Revenu de vente')
    if (cat === 'debt_payment') return t('reports.business.debt_settlement', 'Règlement de dette')
    return cat
  }

  const handleExport = () => {
    const csvContent = [
      ['Date', 'Type', 'Catégorie', 'Montant (MAD)'],
      ...ledgerEntries.map(item => [
        item.date,
        item.type === 'INFLOW' ? 'Entrée' : 'Sortie',
        translateCategory(item.category),
        (item.amount / 100).toFixed(2)
      ])
    ]
      .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'rapport_activite.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full p-1 bg-slate-50/50 dark:bg-transparent min-h-screen">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link 
            href="/dashboard/rapports"
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-855 rounded-lg transition-colors duration-150 cursor-pointer"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {t('reports.business.title', 'Rapports d\'activité')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {t('reports.business.subtitle', 'Analysez les marges bénéficiaires brutes, les coûts d\'exploitation et les flux généraux du grand livre')}
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
        {/* Gross Profit Margin */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              {t('reports.business.profit_margin', 'Marge bénéficiaire brute')}
            </span>
            <span className="text-3xl font-bold text-emerald-800 dark:text-emerald-455 mt-1">
              {profitMargin}%
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-500 font-medium mt-1">
              Calculé sur la base du coût des produits vendus
            </span>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
            <Percent size={24} />
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              {t('reports.business.total_expenses', 'Total des dépenses')}
            </span>
            <span className="text-3xl font-bold text-rose-800 dark:text-rose-455 mt-1">
              {formatMAD(totalExpenses)}
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {t('reports.business.exp_count', 'Sur {{count}} opérations de dépenses', { count: expenseCount })}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-450">
            <Receipt size={24} />
          </div>
        </div>
      </div>

      {/* Cash Flow Ledger Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
          <Landmark size={18} className="text-emerald-600" />
          <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            {t('reports.business.ledger_title', 'Grand livre des flux de trésorerie')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-950/40 border-b border-slate-200 dark:border-zinc-800">
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-36">{t('reports.business.date', 'Date')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-36">{t('reports.business.type', 'Type')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider">{t('reports.business.category', 'Catégorie')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-right w-44">{t('reports.business.amount', 'Montant')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-xs text-slate-400">
                    Chargement du grand livre...
                  </td>
                </tr>
              ) : ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-xs text-slate-400">
                    Aucun flux de trésorerie enregistré.
                  </td>
                </tr>
              ) : (
                ledgerEntries.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/30 dark:hover:bg-zinc-850/40 transition-colors duration-150">
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-zinc-400 font-medium whitespace-nowrap">
                      {item.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold ${
                        item.type === 'INFLOW' 
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30' 
                          : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-450 border border-rose-100/50 dark:border-rose-900/30'
                      }`}>
                        {item.type === 'INFLOW' ? (
                          <>
                            <ArrowUpRight size={10} />
                            <span>Entrée</span>
                          </>
                        ) : (
                          <>
                            <ArrowDownRight size={10} />
                            <span>Sortie</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                      {translateCategory(item.category)}
                    </td>
                    <td className={`px-6 py-4 text-xs font-bold text-right whitespace-nowrap ${
                      item.type === 'INFLOW' ? 'text-emerald-800 dark:text-emerald-450' : 'text-rose-800 dark:text-rose-450'
                    }`}>
                      {item.type === 'INFLOW' ? '+' : '-'}{formatMAD(item.amount)}
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
