'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { ArrowLeft, Download, FileSpreadsheet, ShieldAlert, FileText, CheckCircle, Clock } from 'lucide-react'
import { fetchTaxReportData, TaxReportStats } from '@/lib/expenses-data'

export default function TaxInvoiceReportsPage() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<TaxReportStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTaxReportData().then(data => {
      setStats(data)
      setLoading(false)
    })
  }, [])

  const invoicesHistory = stats?.invoices || []
  const totalTaxCollected = stats?.totalTaxCollected || 0
  const outstandingCount = stats?.outstandingCount || 0

  const formatMAD = (centimes: number) => {
    return 'MAD ' + (centimes / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const handleExport = () => {
    const csvContent = [
      ['N° Facture', 'Client', 'Date', 'Taxe (MAD)', 'Montant Total (MAD)', 'Statut'],
      ...invoicesHistory.map(inv => [
        inv.id,
        inv.client,
        inv.date,
        (inv.tax / 100).toFixed(2),
        (inv.total / 100).toFixed(2),
        inv.status === 'PAID' ? 'Payé' : inv.status === 'PENDING' ? 'En attente' : 'Non payé'
      ])
    ]
      .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'rapport_taxes_factures.csv')
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
              {t('reports.tax.title', 'Rapports de taxes & factures')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {t('reports.tax.subtitle', 'Examinez les taxes sur les ventes accumulées, les soldes impayés et l\'historique des factures')}
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
        {/* Total Tax Collected */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              {t('reports.tax.total_collected', 'Total des taxes collectées')}
            </span>
            <span className="text-3xl font-bold text-emerald-800 dark:text-emerald-455 mt-1">
              {formatMAD(totalTaxCollected)}
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {t('reports.tax.fiscal_year', 'Taxes calculées sur toutes les factures')}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
            <FileSpreadsheet size={24} />
          </div>
        </div>

        {/* Outstanding Invoices */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              {t('reports.tax.outstanding', 'Factures en attente')}
            </span>
            <span className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {outstandingCount}
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-500 font-medium mt-1">
              ⚠️ {t('reports.tax.unpaid_warn', 'Factures non réglées ou partielles')}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
            <ShieldAlert size={24} />
          </div>
        </div>
      </div>

      {/* Invoicing History Ledger Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
          <FileText size={18} className="text-emerald-600" />
          <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            {t('reports.tax.history_title', 'Historique des facturations')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-950/40 border-b border-slate-200 dark:border-zinc-800">
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-36">{t('reports.tax.invoice_id', 'N° Facture')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider">{t('reports.tax.client', 'Client')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-32">{t('reports.tax.date', 'Date')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-right w-36">{t('reports.tax.tax_amt', 'Taxe')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-right w-40">{t('reports.tax.total_amt', 'Montant Total')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-28">{t('reports.tax.status', 'Statut')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-xs text-slate-400">
                    Chargement de l'historique des factures...
                  </td>
                </tr>
              ) : invoicesHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-xs text-slate-400">
                    Aucune facture trouvée.
                  </td>
                </tr>
              ) : (
                invoicesHistory.map((invoice, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/30 dark:hover:bg-zinc-850/40 transition-colors duration-150">
                    <td className="px-6 py-4 text-xs font-mono text-slate-600 dark:text-zinc-400 whitespace-nowrap font-medium">
                      {invoice.id}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                      {invoice.client}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                      {invoice.date}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-zinc-400 text-right whitespace-nowrap font-medium">
                      {formatMAD(invoice.tax)}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-800 dark:text-zinc-200 text-right whitespace-nowrap">
                      {formatMAD(invoice.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold ${
                        invoice.status === 'PAID'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-450 border border-emerald-100/50 dark:border-emerald-900/30'
                          : invoice.status === 'PENDING'
                          ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-450'
                          : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-455'
                      }`}>
                        {invoice.status === 'PAID' ? (
                          <>
                            <CheckCircle size={9} />
                            <span>{t('reports.tax.status.paid', 'Payé')}</span>
                          </>
                        ) : (
                          <>
                            <Clock size={9} />
                            <span>
                              {invoice.status === 'PENDING' 
                                ? t('reports.tax.status.pending', 'En attente') 
                                : t('reports.tax.status.unpaid', 'Non payé')}
                            </span>
                          </>
                        )}
                      </span>
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
