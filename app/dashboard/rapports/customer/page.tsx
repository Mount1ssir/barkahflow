'use client'

import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { ArrowLeft, Download, Users, Landmark, UserCheck } from 'lucide-react'

export default function CustomerReportsPage() {
  const { t } = useTranslation()

  // Realistic Dummy Data
  const clientsAnalysis = [
    { name: 'Yassine Mansouri', phone: '+212 661-234567', orders: 24, debt: 0 }, // debt in centimes
    { name: 'Fatima Zahra', phone: '+212 662-987654', orders: 18, debt: 45000 },
    { name: 'Karim Bennani', phone: '+212 663-555111', orders: 42, debt: 120000 },
    { name: 'Sofia Alami', phone: '+212 664-888222', orders: 12, debt: 350000 }
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
              {t('reports.customer.title', 'Customer Reports')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {t('reports.customer.subtitle', 'Analyse active customer trends, order metrics, and outstanding client ledger debts')}
            </p>
          </div>
        </div>

        <button 
          onClick={() => alert('Customer Report Exported Successfully!')}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors duration-150 shadow-sm cursor-pointer"
        >
          <Download size={15} />
          <span>{t('reports.export', 'Export')}</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Active Clients */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              {t('reports.customer.active_clients', 'Total Active Clients')}
            </span>
            <span className="text-3xl font-bold text-slate-800 dark:text-zinc-200 mt-1">
              184
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-500 font-medium mt-1">
              +8.5% {t('reports.customer.growth', 'growth this month')}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
            <Users size={24} />
          </div>
        </div>

        {/* Total Unpaid Debt */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              {t('reports.customer.unpaid_debt', 'Total Unpaid Debt')}
            </span>
            <span className="text-3xl font-bold text-rose-800 dark:text-rose-455 mt-1">
              {formatMAD(3420000)} {/* 34,200.00 MAD */}
            </span>
            <span className="text-xs text-rose-600 dark:text-rose-500 font-medium mt-1">
              {t('reports.customer.debt_notice', 'Requires immediate reminder actions')}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-450">
            <Landmark size={24} />
          </div>
        </div>
      </div>

      {/* Client Analysis Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
          <UserCheck size={18} className="text-emerald-600" />
          <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            {t('reports.customer.analysis_title', 'Client Order & Debt Profile')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-950/40 border-b border-slate-200 dark:border-zinc-800">
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider">{t('reports.customer.name', 'Client Name')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-44">{t('reports.customer.phone', 'Phone')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-center w-36">{t('reports.customer.orders_count', 'Total Orders')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-right w-44">{t('reports.customer.debt_bal', 'Unpaid Debt Balance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
              {clientsAnalysis.map((client, idx) => (
                <tr key={idx} className="hover:bg-slate-50/30 dark:hover:bg-zinc-850/40 transition-colors duration-150">
                  <td className="px-6 py-4 text-xs font-semibold text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                    {client.name}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-zinc-400 whitespace-nowrap font-mono">
                    {client.phone}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-800 dark:text-zinc-200 text-center font-semibold whitespace-nowrap">
                    {client.orders}
                  </td>
                  <td className={`px-6 py-4 text-xs font-bold text-right whitespace-nowrap ${
                    client.debt > 0 ? 'text-rose-800 dark:text-rose-455' : 'text-slate-500 dark:text-zinc-400'
                  }`}>
                    {formatMAD(client.debt)}
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
