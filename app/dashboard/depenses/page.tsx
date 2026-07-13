'use client'

import { Guard } from '@/components/rbac/Guard'
import { PERMISSIONS } from '@/lib/rbac'
import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useUserContext } from '@/context/UserContext'
import { 
  Plus, 
  Download, 
  Search, 
  SlidersHorizontal,
  X,
  CheckCircle,
  Clock,
  Trash2,
  Calendar,
  Tag,
  Building,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp
} from 'lucide-react'
import { formatMAD } from '@/lib/stats-data'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { fetchExpenses, addExpenseToDb, deleteExpenseFromDb } from '@/lib/expenses-data'
import { getRevenueChartData } from '@/lib/revenue-data'

interface Expense {
  id: string
  date: string
  category: string
  vendor: string
  notes: string
  amount: number // in centimes
  status: 'PENDING' | 'SETTLED'
}

function ExpensesContent() {
  const { t } = useTranslation()
  const { can } = useUserContext()
  
  // ─── Vérification des permissions ──────────────────────────────
  const canView = can(PERMISSIONS.FINANCE_EXPENSES)
  const canExport = can(PERMISSIONS.INVOICES_EXPORT)
  
  // ─── Si l'utilisateur n'a pas la permission ─────────────────────
  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-7xl mx-auto">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
          <TrendingUp className="w-8 h-8 text-gray-300 dark:text-zinc-600" />
        </div>
        <p className="font-semibold text-gray-700 dark:text-gray-300">
          Accès limité aux dépenses
        </p>
        <p className="text-sm text-gray-400 mt-1 max-w-md">
          Vous n'avez pas la permission de voir les dépenses.
        </p>
      </div>
    )
  }

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [chartPeriod, setChartPeriod] = useState<7 | 30>(7)
  const [isMounted, setIsMounted] = useState(false)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [chartData, setChartData] = useState<any[]>([])

  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'SETTLED'>('ALL')
  const [showAddModal, setShowAddModal] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Form State
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formCategory, setFormCategory] = useState('')
  const [formVendor, setFormVendor] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formAmount, setFormAmount] = useState('') // in MAD
  const [formStatus, setFormStatus] = useState<'PENDING' | 'SETTLED'>('SETTLED')

  const loadExpenses = async () => {
    const data = await fetchExpenses()
    setExpenses(data)
  }

  const loadChartData = async () => {
    const data = await getRevenueChartData(0, chartPeriod)
    const mapped = data.map(d => ({
      date: d.fullDate,
      label: d.date,
      income: d.ventes,
      expenses: d.depenses,
      netRevenue: d.solde
    }))
    setChartData(mapped)
  }

  useEffect(() => {
    setIsMounted(true)
    loadExpenses()
  }, [])

  useEffect(() => {
    if (isMounted) {
      loadChartData()
    }
  }, [chartPeriod, expenses, isMounted])

  const totals = useMemo(() => {
    let totalIncome = 0
    let totalExpenses = 0
    let totalNet = 0
    
    chartData.forEach(d => {
      totalIncome += d.income
      totalExpenses += d.expenses
      totalNet += d.netRevenue
    })
    
    return {
      income: totalIncome,
      expenses: totalExpenses,
      net: totalNet,
    }
  }, [chartData])

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-lg text-xs flex flex-col gap-2 min-w-[180px]">
          <p className="font-bold text-slate-800 dark:text-zinc-100 border-b border-slate-100 dark:border-zinc-800 pb-1.5">{data.date}</p>
          <div className="flex flex-col gap-1.5 text-slate-650 dark:text-zinc-400">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {t('expenses.chart.tooltip.income', 'Revenu total :')}
              </span>
              <span className="font-bold text-slate-800 dark:text-zinc-200">{data.income.toFixed(2)} MAD</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {t('expenses.chart.tooltip.expenses', 'Dépenses :')}
              </span>
              <span className="font-bold text-slate-800 dark:text-zinc-200">{data.expenses.toFixed(2)} MAD</span>
            </div>
            <div className="border-t border-slate-100 dark:border-zinc-800 my-1"></div>
            <div className="flex items-center justify-between gap-4 font-semibold text-[13px]">
              <span>{t('expenses.chart.tooltip.net', 'Chiffre d\'affaires net :')}</span>
              <span className={`font-bold ${data.netRevenue >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                {data.netRevenue.toFixed(2)} MAD
              </span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  // Filter & Search Logic
  const filteredExpenses = useMemo(() => {
    return expenses.filter(item => {
      // Tab Filter
      if (activeTab === 'PENDING' && item.status !== 'PENDING') return false
      if (activeTab === 'SETTLED' && item.status !== 'SETTLED') return false

      // Search Query Filter
      if (searchQuery.trim() === '') return true
      const query = searchQuery.toLowerCase()
      return (
        item.category.toLowerCase().includes(query) ||
        item.vendor.toLowerCase().includes(query) ||
        item.notes.toLowerCase().includes(query)
      )
    })
  }, [expenses, activeTab, searchQuery])

  // Actions
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formCategory || !formAmount) {
      alert(t('expenses.errors.required', 'Veuillez remplir les champs obligatoires'))
      return
    }

    const amountInCentimes = Math.round(parseFloat(formAmount) * 100)
    if (isNaN(amountInCentimes) || amountInCentimes <= 0) {
      alert(t('expenses.errors.invalid_amount', 'Veuillez entrer un montant valide'))
      return
    }

    const newExpenseData = {
      date: formDate,
      category: formCategory,
      vendor: formVendor || 'N/A',
      notes: formNotes,
      amount: amountInCentimes,
      status: formStatus
    }

    try {
      const newId = await addExpenseToDb(newExpenseData)
      const newExpense: Expense = {
        id: newId,
        ...newExpenseData
      }
      setExpenses(prev => [newExpense, ...prev])
      setShowAddModal(false)
      triggerToast(t('expenses.messages.added', 'Dépense ajoutée avec succès'))

      // Reset Form
      setFormCategory('')
      setFormVendor('')
      setFormNotes('')
      setFormAmount('')
      setFormStatus('SETTLED')
    } catch (error) {
      console.error('Error adding expense:', error)
      alert('Erreur lors de l\'ajout de la dépense')
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (confirm(t('expenses.confirm.delete', 'Êtes-vous sûr de vouloir supprimer cette dépense ?'))) {
      try {
        await deleteExpenseFromDb(id)
        setExpenses(prev => prev.filter(item => item.id !== id))
        triggerToast(t('expenses.messages.deleted', 'Dépense supprimée avec succès'))
      } catch (error) {
        console.error('Error deleting expense:', error)
        alert('Erreur lors de la suppression de la dépense')
      }
    }
  }

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }

  const handleExport = () => {
    if (!canExport) {
      triggerToast('Vous n\'avez pas la permission d\'exporter')
      return
    }
    const csvContent = [
      ['Date', 'Categorie', 'Fournisseur/Source', 'Notes', 'Statut', 'Montant (MAD)'],
      ...filteredExpenses.map(item => [
        item.date,
        item.category,
        item.vendor,
        item.notes,
        item.status === 'SETTLED' ? 'Réglé' : 'En attente',
        (item.amount / 100).toFixed(2)
      ])
    ]
      .map(e => e.map(val => `"${val?.replace(/"/g, '""') || ''}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'depenses.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    triggerToast(t('expenses.messages.exported', 'CSV exporté avec succès !'))
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full p-1 bg-slate-50/50 dark:bg-transparent min-h-screen relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg border border-slate-800 text-sm animate-in fade-in slide-in-from-bottom-5 duration-300">
          <CheckCircle size={16} className="text-blue-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {t('expenses.title', 'Dépenses')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {t('expenses.subtitle', 'Gérez les coûts opérationnels, les factures et les sorties de trésorerie de l\'entreprise')}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {canExport && (
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors duration-150 shadow-sm cursor-pointer"
            >
              <Download size={15} />
              <span>{t('expenses.export', 'Exporter')}</span>
            </button>
          )}

          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors duration-150 shadow-sm shadow-blue-600/10 cursor-pointer"
          >
            <Plus size={15} />
            <span>{t('expenses.add', 'Ajouter une dépense')}</span>
          </button>
        </div>
      </div>

      {/* Net Revenue Chart Card */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 flex flex-col gap-6">
        {/* Chart Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="text-blue-600" size={18} />
              <span>{t('expenses.chart.title', "Chiffre d'affaires net")}</span>
            </h3>
          </div>
          
          <div className="flex items-center bg-slate-100/80 dark:bg-zinc-800 p-0.5 rounded-lg self-start sm:self-auto">
            {([7, 30] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setChartPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 cursor-pointer ${
                  chartPeriod === p
                    ? 'bg-white dark:bg-zinc-700 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                {p === 7 ? t('expenses.chart.period.7d', '7 jours') : t('expenses.chart.period.30d', '30 jours')}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Summaries */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50/50 dark:bg-zinc-950/40 border border-slate-100 dark:border-zinc-850 rounded-xl p-4 flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
              {t('expenses.chart.summary.net', 'Chiffre d\'affaires net')}
            </span>
            <span className={`text-xl font-extrabold ${totals.net >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-rose-700 dark:text-rose-450'}`}>
              {totals.net.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
            </span>
            <div className="flex items-center gap-1 mt-1">
              {totals.net >= 0 ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded-md border border-blue-100/50 dark:border-blue-900/30">
                  <ArrowUpRight size={10} />
                  <span>Tendance positive</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-455 rounded-md border border-rose-100/50 dark:border-rose-900/30">
                  <ArrowDownRight size={10} />
                  <span>Déficit</span>
                </span>
              )}
            </div>
          </div>

          <div className="bg-slate-50/50 dark:bg-zinc-950/40 border border-slate-100 dark:border-zinc-850 rounded-xl p-4 flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
              {t('expenses.chart.summary.income', 'Revenu total')}
            </span>
            <span className="text-xl font-extrabold text-slate-800 dark:text-zinc-200">
              {totals.income.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
            </span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
              Basé sur les enregistrements de caisse
            </span>
          </div>

          <div className="bg-slate-50/50 dark:bg-zinc-950/40 border border-slate-100 dark:border-zinc-850 rounded-xl p-4 flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
              {t('expenses.chart.summary.expenses', 'Total des dépenses')}
            </span>
            <span className="text-xl font-extrabold text-slate-800 dark:text-zinc-200">
              {totals.expenses.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
            </span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
              Somme des opérations sur la période
            </span>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="h-64 w-full mt-2">
          {!isMounted ? (
            <div className="w-full h-full bg-slate-50 dark:bg-zinc-950 animate-pulse rounded-xl flex items-center justify-center text-xs text-slate-400 dark:text-zinc-600">
              Chargement du graphique...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: 20, right: 20, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillNetRevenueExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-200/60 dark:stroke-zinc-800/60" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                />
                <YAxis
                  width={95}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                  tickFormatter={(val) => `${val.toLocaleString()} MAD`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  dataKey="netRevenue"
                  type="monotone"
                  fill="url(#fillNetRevenueExpenses)"
                  stroke="#2563EB"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Main Ledger Card Container */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        
        {/* Filters and Actions Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between p-5 gap-4 border-b border-slate-100 dark:border-zinc-800">
          
          {/* Filter Tabs */}
          <div className="flex border-b border-slate-100 dark:border-zinc-800 lg:border-none pb-2 lg:pb-0 gap-1">
            {(['ALL', 'PENDING', 'SETTLED'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
                  activeTab === tab 
                    ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-450 border border-blue-100 dark:border-blue-900/30' 
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800 border border-transparent'
                }`}
              >
                {tab === 'ALL' && t('expenses.filter.all', 'Tout')}
                {tab === 'PENDING' && t('expenses.filter.pending', 'En attente')}
                {tab === 'SETTLED' && t('expenses.filter.settled', 'Réglé')}
              </button>
            ))}
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-3 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 lg:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" size={15} />
              <input
                type="text"
                placeholder={t('expenses.search_placeholder', 'Rechercher une catégorie, un fournisseur, des notes...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 dark:bg-zinc-950/40 text-slate-800 dark:text-slate-100"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Icon button */}
            <button className="p-2 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors duration-150 cursor-pointer">
              <SlidersHorizontal size={15} />
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-950/40 border-b border-slate-200 dark:border-zinc-800">
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-32">{t('expenses.table.date', 'Date')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider">{t('expenses.table.category', 'Catégorie')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider">{t('expenses.table.vendor', 'Fournisseur/Source')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider max-w-xs">{t('expenses.table.notes', 'Notes')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider w-28">{t('expenses.table.status', 'Statut')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-right w-36">{t('expenses.table.amount', 'Montant')}</th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-center w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400 dark:text-zinc-500">
                    {t('expenses.table.empty', 'Aucune dépense trouvée correspondant aux critères')}
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/40 dark:hover:bg-zinc-800/40 transition-colors duration-150 group">
                    {/* Date */}
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-zinc-400 font-medium whitespace-nowrap">
                      {item.date}
                    </td>
                    
                    {/* Category */}
                    <td className="px-6 py-4 text-xs font-semibold text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                      {item.category}
                    </td>

                    {/* Vendor */}
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                      {item.vendor}
                    </td>

                    {/* Notes */}
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-zinc-400 max-w-xs truncate">
                      {item.notes || '-'}
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                        item.status === 'SETTLED'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30'
                          : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-100/50 dark:border-amber-900/30'
                      }`}>
                        {item.status === 'SETTLED' ? (
                          <>
                            <CheckCircle size={10} />
                            <span>{t('expenses.status.settled', 'Réglé')}</span>
                          </>
                        ) : (
                          <>
                            <Clock size={10} />
                            <span>{t('expenses.status.pending', 'En attente')}</span>
                          </>
                        )}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-6 py-4 text-xs font-bold text-slate-800 dark:text-zinc-100 text-right whitespace-nowrap">
                      {formatMAD(item.amount)}
                    </td>

                    {/* Action Panel */}
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <button 
                        onClick={() => handleDeleteExpense(item.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors duration-150 opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Supprimer la dépense"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Summary Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-slate-50/50 dark:bg-zinc-950/40 border-t border-slate-100 dark:border-zinc-800 gap-2">
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {t('expenses.summary.count', 'Affichage de {{count}} entrées', { count: filteredExpenses.length })}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{t('expenses.summary.total', 'Montant total :')}</span>
            <span className="text-sm font-bold text-blue-800 dark:text-blue-400">
              {formatMAD(filteredExpenses.reduce((sum, item) => sum + item.amount, 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Modal - Add Expense Form */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                {t('expenses.modal.title', 'Ajouter une nouvelle dépense')}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors duration-150 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddExpense} className="p-5 flex flex-col gap-4">
              
              {/* Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <Calendar size={13} className="text-slate-400 dark:text-zinc-500" />
                  <span>{t('expenses.modal.date', 'Date')} *</span>
                </label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-zinc-950 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Category */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <Tag size={13} className="text-slate-400 dark:text-zinc-500" />
                  <span>{t('expenses.modal.category', 'Catégorie')} *</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('expenses.placeholder.category', 'ex. Loyer, Services publics, Fourniture de stock')}
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-zinc-950 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Vendor */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <Building size={13} className="text-slate-400 dark:text-zinc-500" />
                  <span>{t('expenses.modal.vendor', 'Fournisseur/Source')}</span>
                </label>
                <input
                  type="text"
                  placeholder={t('expenses.placeholder.vendor', 'ex. Distribution Sidi Ali, nom du propriétaire')}
                  value={formVendor}
                  onChange={(e) => setFormVendor(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-zinc-950 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Amount */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">MAD</span>
                  <span>{t('expenses.modal.amount', 'Montant (MAD)')} *</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-zinc-950 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <FileText size={13} className="text-slate-400 dark:text-zinc-500" />
                  <span>{t('expenses.modal.notes', 'Notes')}</span>
                </label>
                <textarea
                  placeholder={t('expenses.placeholder.notes', 'Décrivez les détails de la dépense...')}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-zinc-950 text-slate-800 dark:text-slate-100 resize-none"
                />
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400">
                  {t('expenses.modal.status', 'Statut')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormStatus('SETTLED')}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all duration-150 cursor-pointer ${
                      formStatus === 'SETTLED'
                        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-500 text-blue-700 dark:text-blue-400'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {t('expenses.status.settled', 'Réglé')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStatus('PENDING')}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all duration-150 cursor-pointer ${
                      formStatus === 'PENDING'
                        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 text-amber-700 dark:text-amber-450'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {t('expenses.status.pending', 'En attente')}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-850 border border-slate-200 dark:border-zinc-800 rounded-lg transition-colors duration-150 cursor-pointer"
                >
                  {t('expenses.modal.cancel', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors duration-150 cursor-pointer"
                >
                  {t('expenses.modal.save', 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExpensesPage() {
  return (
    <Guard permission={PERMISSIONS.FINANCE_EXPENSES} redirectTo="/dashboard">
      <ExpensesContent />
    </Guard>
  )
}