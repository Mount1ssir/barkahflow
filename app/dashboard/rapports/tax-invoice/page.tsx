'use client'

import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { ArrowLeft, Download, FileSpreadsheet, ShieldAlert, FileText, CheckCircle, Clock } from 'lucide-react'

export default function TaxInvoiceReportsPage() {
  const { t } = useTranslation()

  // Realistic Dummy Data
  const invoicesHistory = [
    { id: 'INV-2026-0045', client: 'Yassine Mansouri', date: '2026-07-06', tax: 20000, total: 120000, status: 'PAID' }, // in centimes
    { id: 'INV-2026-0044', client: 'Fatima Zahra', date: '2026-07-05', tax: 15000, total: 90000, status: 'PENDING' },
    { id: 'INV-2026-0043', client: 'Karim Bennani', date: '2026-07-04', tax: 30000, total: 180000, status: 'PAID' },
    { id: 'INV-2026-0042', client: 'Sofia Alami', date: '2026-07-02', tax: 40000, total: 240000, status: 'UNPAID' }
  ]

  const formatMAD = (centimes: number) => {
    return 'MAD ' + (centimes / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
              {t('reports.tax.title', 'Tax & Invoice Reports')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {t('reports.tax.subtitle', 'Review accumulated sales taxes, outstanding balances, and invoice histories')}
            </p>
          </div>
        </div>

        <button 
          onClick={() => alert('Tax Invoice Report Exported Successfully!')}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors duration-150 shadow-sm cursor-pointer"
        >
          <Download size={15} />
          <span>{t('reports.export', 'Export')}</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Tax Collected */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              {t('reports.tax.total_collected', 'Total Tax Collected')}
            </span>
            <span className="text-3xl font-bold text-emerald-800 dark:text-emerald-400 mt-1">
              {formatMAD(2490000)} {/* 24,900.00 MAD */}
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {t('reports.tax.fiscal_year', 'Tax calculated for current quarter')}
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
              {t('reports.tax.outstanding', 'Outstanding Invoices')}
            </span>
            <span className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              14
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-500 font-medium mt-1">
              ⚠️ {t('reports.tax.unpaid_warn', 'Pending client collection actions')}
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
            {t('reports.tax.history_title', 'Invoicing History')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-950/40 border-b border-slate-200 dark:border-zinc-800">
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-36">{t('reports.tax.invoice_id', 'Invoice ID')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider">{t('reports.tax.client', 'Client')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-32">{t('reports.tax.date', 'Date')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-right w-36">{t('reports.tax.tax_amt', 'Tax')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-right w-40">{t('reports.tax.total_amt', 'Total Amount')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-28">{t('reports.tax.status', 'Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
              {invoicesHistory.map((invoice, idx) => (
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
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30'
                        : invoice.status === 'PENDING'
                        ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-450'
                        : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-455'
                    }`}>
                      {invoice.status === 'PAID' ? (
                        <>
                          <CheckCircle size={9} />
                          <span>Paid</span>
                        </>
                      ) : (
                        <>
                          <Clock size={9} />
                          <span>{invoice.status === 'PENDING' ? 'Pending' : 'Unpaid'}</span>
                        </>
                      )}
                    </span>
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
