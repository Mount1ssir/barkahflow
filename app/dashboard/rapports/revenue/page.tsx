'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { ArrowLeft, Download, TrendingUp, ShoppingBag, Wallet, FileText, CheckCircle, Clock } from 'lucide-react'
import { fetchRevenueReportData, RevenueReportStats, RegularSaleEntry, ExternalSaleEntry } from '@/lib/expenses-data'

export default function RevenueReportsPage() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<RevenueReportStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'regular' | 'external'>('regular')

  useEffect(() => {
    fetchRevenueReportData().then(data => {
      setStats(data)
      setLoading(false)
    })
  }, [])

  const regularSales = stats?.regularSales || []
  const externalSales = stats?.externalSales || []
  const regularTotal = stats?.regularTotal || 0
  const regularCount = stats?.regularCount || 0
  const externalTotal = stats?.externalTotal || 0
  const externalCount = stats?.externalCount || 0
  const totalRevenue = regularTotal + externalTotal

  const formatMAD = (centimes: number) => {
    return 'MAD ' + (centimes / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const translatePaymentMethod = (method: string) => {
    const labels: Record<string, string> = {
      cash: t('common.payment.cash', 'Espèces'),
      card: t('common.payment.card', 'TPE'),
      mobile: t('common.payment.mobile', 'Mobile'),
      mixed: t('common.payment.mixed', 'Mixte'),
    }
    return labels[method] || method
  }

  const handleExport = () => {
    let csvContent = ''
    let filename = 'rapport_revenus.csv'

    if (activeTab === 'regular') {
      csvContent = [
        ['N° Facture', 'Client', 'Date', 'Mode de Paiement', 'Statut', 'Montant (MAD)'],
        ...regularSales.map(s => [
          s.invoiceNumber,
          s.client,
          s.date,
          translatePaymentMethod(s.paymentMethod),
          s.status === 'PAID' ? 'Payé' : s.status === 'PENDING' ? 'En attente' : 'Non payé',
          (s.amount / 100).toFixed(2)
        ])
      ]
        .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
        .join('\n')
      filename = 'rapport_revenus_reguliers.csv'
    } else {
      csvContent = [
        ['ID Transaction', 'Description', 'Date', 'Mode de Paiement', 'Statut', 'Montant (MAD)'],
        ...externalSales.map(e => [
          e.id,
          e.description,
          e.date,
          translatePaymentMethod(e.paymentMethod),
          'Payé',
          (e.amount / 100).toFixed(2)
        ])
      ]
        .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
        .join('\n')
      filename = 'rapport_revenus_externes.csv'
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
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
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-850 rounded-lg transition-colors duration-150 cursor-pointer"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {t('reports.revenue.title', 'Rapports de revenus')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {t('reports.revenue.subtitle', 'Suivez les revenus issus des ventes régulières et des événements externes')}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Revenue */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              {t('reports.revenue.total_revenue', 'Revenu Total')}
            </span>
            <span className="text-3xl font-bold text-slate-800 dark:text-zinc-200 mt-1">
              {formatMAD(totalRevenue)}
            </span>
            <span className="text-xs text-blue-600 dark:text-blue-500 font-medium mt-1">
              Ventes régulières + Revenus externes
            </span>
          </div>
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Regular Sales */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              {t('reports.revenue.regular_sales', 'Ventes Régulières')}
            </span>
            <span className="text-3xl font-bold text-emerald-800 dark:text-emerald-455 mt-1">
              {formatMAD(regularTotal)}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-500 font-medium mt-1">
              {t('reports.revenue.based_on_invoices', '{{count}} factures émises', { count: regularCount })}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
            <ShoppingBag size={24} />
          </div>
        </div>

        {/* External Sales */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              {t('reports.revenue.external_sales', 'Ventes / Revenus Externes')}
            </span>
            <span className="text-3xl font-bold text-amber-800 dark:text-amber-500 mt-1">
              {formatMAD(externalTotal)}
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-500 font-medium mt-1">
              {t('reports.revenue.based_on_events', '{{count}} événements enregistrés', { count: externalCount })}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-450">
            <Wallet size={24} />
          </div>
        </div>
      </div>

      {/* Tabs Selection */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 gap-6">
        <button
          onClick={() => setActiveTab('regular')}
          className="pb-3 text-sm font-semibold border-b-2 transition-colors duration-150 cursor-pointer border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-405"
          style={{
            borderColor: activeTab === 'regular' ? '' : 'transparent',
            color: activeTab === 'regular' ? '' : 'inherit'
          }}
        >
          {t('reports.revenue.regular_sales_tab', 'Ventes Régulières')}
        </button>
        <button
          onClick={() => setActiveTab('external')}
          className="pb-3 text-sm font-semibold border-b-2 transition-colors duration-150 cursor-pointer border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-405"
          style={{
            borderColor: activeTab === 'external' ? '' : 'transparent',
            color: activeTab === 'external' ? '' : 'inherit'
          }}
        >
          {t('reports.revenue.external_sales_tab', 'Revenus Externes')}
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
          <FileText size={18} className="text-blue-600" />
          <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            {activeTab === 'regular'
              ? t('reports.revenue.regular_details', 'Détails des Ventes')
              : t('reports.revenue.external_details', 'Détails des Revenus Externes')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          {activeTab === 'regular' ? (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-zinc-950/40 border-b border-slate-200 dark:border-zinc-800">
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-36">{t('reports.revenue.invoice_id', 'N° Facture')}</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider">{t('reports.revenue.client', 'Client')}</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-32">{t('reports.revenue.date', 'Date')}</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-36">{t('reports.revenue.payment_method', 'Paiement')}</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-28">{t('reports.revenue.status', 'Statut')}</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-right w-40">{t('reports.revenue.amount', 'Montant')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-xs text-slate-400">
                      Chargement des ventes régulières...
                    </td>
                  </tr>
                ) : regularSales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-xs text-slate-400">
                      Aucune vente régulière enregistrée.
                    </td>
                  </tr>
                ) : (
                  regularSales.map((sale: RegularSaleEntry, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/30 dark:hover:bg-zinc-850/40 transition-colors duration-150">
                      <td className="px-6 py-4 text-xs font-mono text-slate-600 dark:text-zinc-400 whitespace-nowrap font-medium">
                        {sale.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                        {sale.client}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                        {sale.date}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                        {translatePaymentMethod(sale.paymentMethod)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold ${sale.status === 'PAID'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-450 border border-emerald-100/50 dark:border-emerald-900/30'
                          : sale.status === 'PENDING'
                            ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-450'
                            : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-455'
                          }`}>
                          {sale.status === 'PAID' ? (
                            <>
                              <CheckCircle size={9} />
                              <span>{t('reports.revenue.status.paid', 'Payé')}</span>
                            </>
                          ) : (
                            <>
                              <Clock size={9} />
                              <span>
                                {sale.status === 'PENDING'
                                  ? t('reports.revenue.status.pending', 'En attente')
                                  : t('reports.revenue.status.unpaid', 'Non payé')}
                              </span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-800 dark:text-zinc-200 text-right whitespace-nowrap">
                        {formatMAD(sale.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-zinc-950/40 border-b border-slate-200 dark:border-zinc-800">
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-40">{t('reports.revenue.tx_id', 'ID Transaction')}</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider">{t('reports.revenue.description', 'Description')}</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-32">{t('reports.revenue.date', 'Date')}</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-36">{t('reports.revenue.payment_method', 'Paiement')}</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-28">{t('reports.revenue.status', 'Statut')}</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-right w-40">{t('reports.revenue.amount', 'Montant')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-xs text-slate-400">
                      Chargement des revenus externes...
                    </td>
                  </tr>
                ) : externalSales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-xs text-slate-400">
                      Aucun revenu externe enregistré.
                    </td>
                  </tr>
                ) : (
                  externalSales.map((event: ExternalSaleEntry, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/30 dark:hover:bg-zinc-850/40 transition-colors duration-150">
                      <td className="px-6 py-4 text-xs font-mono text-slate-600 dark:text-zinc-400 whitespace-nowrap font-medium">
                        {event.id}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                        {event.description}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                        {event.date}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                        {translatePaymentMethod(event.paymentMethod)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-450 border border-emerald-100/50 dark:border-emerald-900/30">
                          <CheckCircle size={9} />
                          <span>{t('reports.revenue.status.paid', 'Payé')}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-800 dark:text-zinc-200 text-right whitespace-nowrap">
                        {formatMAD(event.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
