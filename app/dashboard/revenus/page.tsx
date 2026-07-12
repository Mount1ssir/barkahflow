'use client'

import { Guard } from '@/components/rbac/Guard'
import { PERMISSIONS } from '@/lib/rbac'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  CreditCard,
  Smartphone,
  Repeat,
  Calendar,
  Download,
  Receipt,
  Wallet,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getRevenueSummary,
  getPaymentMethodDistribution,
  getTopProductsByRevenue,
  getTransactions,
  getAgedReceivables,
  addExternalRevenue,
  type RevenueSummary,
  type PaymentMethodDistribution,
  type TopProductRevenue,
  type Transaction,
  type AgedReceivable,
} from '@/lib/revenue-data'
import { formatMAD } from '@/lib/stats-data'
import { useUserContext } from '@/context/UserContext'

// ─── Couleurs ──────────────────────────────────────────────────────
const BLUE_SOFT = '#93C5FD'
const BLUE = '#3B82F6'
const BLUE_DARK = '#1D4ED8'
const ORANGE = '#F59E0B'
const ORANGE_DARK = '#EA580C'
const GREEN = '#22C55E'
const RED = '#EF4444'

const PAYMENT_CHART_COLORS = {
  cash: BLUE_DARK,
  card: BLUE,
  mobile: ORANGE,
  mixed: '#9CA3AF',
}

const PERIODS = [
  { label: 'today', value: 'today' },
  { label: 'week', value: 'week' },
  { label: 'month', value: 'month' },
  { label: 'quarter', value: 'quarter' },
  { label: 'year', value: 'year' },
]

// ─── KPI Card ──────────────────────────────────────────────────────

interface KpiCardProps {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  trend?: number
}

function KpiCard({ title, value, subtitle, icon, trend }: KpiCardProps) {
  const { t } = useTranslation()
  const isPositive = trend !== undefined && trend > 0
  const isZero = trend === 0 || trend === undefined

  return (
    <Card
      className="rounded-xl border shadow-sm bg-white dark:bg-gray-900 transition-all hover:shadow-md"
      style={{ borderColor: BLUE_SOFT }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">{subtitle}</p>
          </div>
          <div className="text-green-500">{icon}</div>
        </div>
        {trend !== undefined && (
          <div className="mt-2 flex items-center justify-end gap-1">
            {!isZero ? (
              <>
                {isPositive ? (
                  <TrendingUp size={12} className="text-green-500" />
                ) : (
                  <TrendingDown size={12} className="text-red-500" />
                )}
                <span
                  className={`text-[10px] font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {isPositive ? '+' : ''}{trend}%
                </span>
              </>
            ) : (
              <span className="text-[10px] text-gray-400">—</span>
            )}
            <span className="text-[10px] text-gray-400">{t('revenue_page.vs_previous_period', 'vs période préc.')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Pagination ────────────────────────────────────────────────────

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}

function Pagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }: PaginationProps) {
  const { t } = useTranslation()
  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-500 dark:text-gray-400">
      <span>
        {t('showing_records', 'Affichage')} {start} {t('common.to', 'à')} {end} {t('common.of', 'sur')} {totalItems} {t('revenue_page.transactions_count', 'transaction(s)')}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0 rounded-xl"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-3 text-sm font-medium">{currentPage} / {totalPages}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 p-0 rounded-xl"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────

function RevenusContent() {
  const { t } = useTranslation()
  const router = useRouter()
  const { can } = useUserContext()
  
  // ─── Vérification des permissions ──────────────────────────────
  const canView = can(PERMISSIONS.FINANCE_REVENUE)
  const canExport = can(PERMISSIONS.INVOICES_EXPORT)
  const canAddRevenue = can(PERMISSIONS.FINANCE_REVENUE) // Même permission pour ajouter
  
  // ─── Si l'utilisateur n'a pas la permission ─────────────────────
  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-7xl mx-auto">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
          <DollarSign className="w-8 h-8 text-gray-300 dark:text-zinc-600" />
        </div>
        <p className="font-semibold text-gray-700 dark:text-gray-300">
          {t('revenue_page.restricted_title', 'Accès limité aux revenus')}
        </p>
        <p className="text-sm text-gray-400 mt-1 max-w-md">
          {t('revenue_page.restricted_desc', "Vous n'avez pas la permission de voir les revenus.")}
        </p>
      </div>
    )
  }

  const [period, setPeriod] = useState('month')
  const [loading, setLoading] = useState(true)

  const [summary, setSummary] = useState<RevenueSummary | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodDistribution[]>([])
  const [topProducts, setTopProducts] = useState<TopProductRevenue[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [agedReceivables, setAgedReceivables] = useState<AgedReceivable[]>([])

  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')

  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5

  // ─── Ajout d'un revenu externe ──────────────────────────────────
  const [addRevenueOpen, setAddRevenueOpen] = useState(false)
  const [newAmount, setNewAmount] = useState('')
  const [newPaymentMethod, setNewPaymentMethod] = useState('cash')
  const [newDescription, setNewDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setCurrentPage(1)
  }, [period, statusFilter, paymentFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      const [s, pm, tp, tx, ar] = await Promise.all([
        getRevenueSummary(period),
        getPaymentMethodDistribution(period),
        getTopProductsByRevenue(period, 5),
        getTransactions(period, { status: statusFilter, paymentMethod: paymentFilter }),
        getAgedReceivables(period),
      ])
      setSummary(s)
      setPaymentMethods(pm)
      setTopProducts(tp)
      setTransactions(tx)
      setAgedReceivables(ar)
    } catch (error) {
      console.error(error)
      toast.error(t('errors.load_failed', 'Erreur lors du chargement des données'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [period, statusFilter, paymentFilter])

  const handleAddExternalRevenue = async () => {
    const amountValue = parseFloat(newAmount.replace(',', '.'))
    if (!amountValue || amountValue <= 0) {
      toast.error(t('errors.invalid_amount', 'Merci de saisir un montant valide'))
      return
    }

    setSubmitting(true)
    try {
      await addExternalRevenue({
        amount: Math.round(amountValue * 100),
        paymentMethod: newPaymentMethod,
        description: newDescription.trim() || undefined,
      })
      toast.success(t('revenue_page.revenue_added', 'Revenu externe ajouté'))
      setAddRevenueOpen(false)
      setNewAmount('')
      setNewDescription('')
      setNewPaymentMethod('cash')
      loadData()
    } catch (error) {
      console.error(error)
      toast.error(t('errors.add_revenue_failed', "Erreur lors de l'ajout du revenu"))
    } finally {
      setSubmitting(false)
    }
  }

  const totalItems = transactions.length
  const totalPages = Math.ceil(totalItems / pageSize)
  const paginatedTransactions = transactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const encaissementRate = summary && summary.caTTC > 0
    ? Math.round((summary.encaisse / summary.caTTC) * 100)
    : 0

  const totalReceivables = agedReceivables.reduce((sum, item) => sum + item.amount, 0)

  // ─── EXPORT CSV ──────────────────────────────────────────────────
  const handleExport = () => {
    if (!canExport) {
      toast.warning(t('errors.no_permission_export', "Vous n'avez pas la permission d'exporter"))
      return
    }
    if (transactions.length === 0) {
      toast.info(t('revenue_page.no_transactions_to_export', 'Aucune transaction à exporter pour cette période.'))
      return
    }

    const headers = [
      t('revenue_page.invoice_number', 'N° facture'),
      t('revenue_page.date', 'Date'),
      t('revenue_page.client', 'Client'),
      t('revenue_page.payment_method', 'Mode de paiement'),
      t('revenue_page.status', 'Statut'),
      t('revenue_page.amount_ttc', 'Montant TTC (MAD)'),
    ]

    const rows = transactions.map((tx) => {
      const statusLabel =
        tx.status === 'PAID' ? t('revenue_page.paid', 'Payée') :
        tx.status === 'PARTIAL' ? t('revenue_page.pending', 'En attente') : t('revenue_page.unpaid', 'Impayée')
      const paymentLabel: Record<string, string> = {
        cash: t('revenue_page.cash', 'Espèces'),
        card: t('revenue_page.tpe', 'TPE'),
        mobile: t('revenue_page.mobile', 'Mobile'),
        mixed: t('revenue_page.mixed', 'Mixte'),
      }
      return [
        tx.invoiceNumber,
        new Date(tx.date).toLocaleDateString('fr-FR'),
        tx.client,
        paymentLabel[tx.paymentMethod] || tx.paymentMethod,
        statusLabel,
        (tx.amount / 100).toFixed(2),
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const periodObj = PERIODS.find((p) => p.value === period)
    const periodLabel = periodObj ? t('revenue_page.periods.' + periodObj.label, periodObj.label) : period
    link.download = `revenus_${periodLabel}_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    toast.success(t('revenue_page.transactions_exported', `${transactions.length} transactions exportées`, { count: transactions.length }))
  }

  // ─── Redirection vers les factures avec filtres de dates ──────
  const goToInvoicesWithFilter = (range: string, amount: number) => {
    if (amount === 0) return

    const now = new Date()
    let dateFrom: Date, dateTo: Date

    switch (range) {
      case '0-7 jours':
        dateTo = new Date(now)
        dateTo.setDate(dateTo.getDate() - 0)
        dateFrom = new Date(now)
        dateFrom.setDate(dateFrom.getDate() - 7)
        break
      case '8-30 jours':
        dateTo = new Date(now)
        dateTo.setDate(dateTo.getDate() - 8)
        dateFrom = new Date(now)
        dateFrom.setDate(dateFrom.getDate() - 30)
        break
      case '31-60 jours':
        dateTo = new Date(now)
        dateTo.setDate(dateTo.getDate() - 31)
        dateFrom = new Date(now)
        dateFrom.setDate(dateFrom.getDate() - 60)
        break
      case '+60 jours':
        dateTo = new Date(now)
        dateTo.setDate(dateTo.getDate() - 61)
        dateFrom = new Date(0)
        break
      default:
        return
    }

    const fromStr = dateFrom.toISOString().split('T')[0]
    const toStr = dateTo.toISOString().split('T')[0]

    router.push(`/dashboard/factures?status=UNPAID&dateFrom=${fromStr}&dateTo=${toStr}`)
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">

      {/* ─── HEADER ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('revenue_page.title', 'Évolution des ventes')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('revenue_page.subtitle', 'Analysez votre chiffre d\'affaires, vos encaissements et vos créances.')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40 rounded-xl h-10 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <Calendar className="mr-2 h-4 w-4 text-gray-400" />
              <SelectValue placeholder={t('revenue_page.period', 'Période')} />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {t('revenue_page.periods.' + p.label, p.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canAddRevenue && (
            <Button
              className="gap-2 rounded-xl h-10 text-white"
              style={{ backgroundColor: BLUE }}
              onClick={() => setAddRevenueOpen(true)}
            >
              <Plus className="h-4 w-4" /> {t('revenue_page.add_revenue', 'Ajouter un revenu')}
            </Button>
          )}
          {canExport && (
            <Button
              variant="outline"
              className="gap-2 rounded-xl h-10 border-gray-200 dark:border-gray-700"
              onClick={handleExport}
            >
              <Download className="h-4 w-4" /> {t('revenue_page.export', 'Exporter')}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* ─── 6 CARTES KPI ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard
              title={t('revenue_page.ca_ht', 'CA HT')}
              value={summary ? formatMAD(summary.caHT) : '0 MAD'}
              subtitle={t('revenue_page.excl_tax', 'Hors taxes')}
              icon={<Receipt className="h-4 w-4" />}
              trend={12.5}
            />
            <KpiCard
              title={t('revenue_page.ca_ttc', 'CA TTC')}
              value={summary ? formatMAD(summary.caTTC) : '0 MAD'}
              subtitle={t('revenue_page.incl_tax', 'Toutes taxes comprises')}
              icon={<DollarSign className="h-4 w-4" />}
              trend={8.3}
            />
            <KpiCard
              title={t('revenue_page.collected', 'Encaissé')}
              value={summary ? formatMAD(summary.encaisse) : '0 MAD'}
              subtitle={`${encaissementRate}% ${t('revenue_page.of_ca_ttc', 'du CA TTC')}`}
              icon={<Wallet className="h-4 w-4" />}
              trend={5.1}
            />
            <KpiCard
              title={t('revenue_page.receivables', 'Créances')}
              value={summary ? formatMAD(summary.creances) : '0 MAD'}
              subtitle={t('revenue_page.unpaid_invoices', 'Factures impayées')}
              icon={<ShoppingBag className="h-4 w-4" />}
              trend={-2.0}
            />
            <KpiCard
              title={t('revenue_page.gross_margin', 'Marge brute')}
              value={summary ? formatMAD(summary.margeBrute) : '0 MAD'}
              subtitle={t('revenue_page.margin_desc', "CA HT - Coût d'achat")}
              icon={<TrendingUp className="h-4 w-4" />}
              trend={3.2}
            />
            <KpiCard
              title={t('revenue_page.avg_basket', 'Panier moyen')}
              value={summary ? formatMAD(summary.panierMoyen) : '0 MAD'}
              subtitle={t('revenue_page.avg_basket_desc', `Moyenne sur ${summary?.nbTransactions || 0} transactions`, { count: summary?.nbTransactions || 0 })}
              icon={<ShoppingBag className="h-4 w-4" />}
            />
          </div>

          {/* ─── 3 GRAPHIQUES ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* 1. Répartition par mode de paiement */}
            <Card className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                  {t('revenue_page.payment_method_distribution', 'Répartition par mode de paiement')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentMethods.every((p) => p.value === 0) ? (
                  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                    {t('revenue_page.no_data_period', 'Aucune donnée pour cette période')}
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-40 h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={paymentMethods}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={3}
                            cornerRadius={6}
                            stroke="none"
                          >
                            {paymentMethods.map((entry) => {
                              const key = entry.name === 'Espèces' ? 'cash' :
                                          entry.name === 'TPE' ? 'card' :
                                          entry.name === 'Mobile' ? 'mobile' : 'mixed'
                              return <Cell key={entry.name} fill={PAYMENT_CHART_COLORS[key] || '#6B7280'} />
                            })}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-1.5 mt-4 w-full">
                      {paymentMethods.map((item) => {
                        const Icon = item.name === 'Espèces' ? DollarSign :
                                     item.name === 'TPE' ? CreditCard :
                                     item.name === 'Mobile' ? Smartphone : Repeat
                        const key = item.name === 'Espèces' ? 'cash' :
                                    item.name === 'TPE' ? 'card' :
                                    item.name === 'Mobile' ? 'mobile' : 'mixed'
                        const color = PAYMENT_CHART_COLORS[key] || '#6B7280'
                        const translatedName = item.name === 'Espèces' ? t('revenue_page.cash', 'Espèces') :
                                               item.name === 'TPE' ? t('revenue_page.tpe', 'TPE') :
                                               item.name === 'Mobile' ? t('revenue_page.mobile', 'Mobile') :
                                               item.name === 'Mixte' ? t('revenue_page.mixed', 'Mixte') : item.name
                        return (
                          <div key={item.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                              <Icon className="h-3 w-3 text-gray-400" />
                              <span className="text-gray-700 dark:text-gray-300">{translatedName}</span>
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {formatMAD(item.value)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 2. Top produits par CA */}
            <Card className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                  {t('revenue_page.top_products_revenue', 'Top produits par CA')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                    {t('revenue_page.no_product_sold_period', 'Aucun produit vendu sur cette période')}
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topProducts}
                        layout="vertical"
                        margin={{ left: 0, right: 16, top: 5, bottom: 5 }}
                      >
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis type="number" tickLine={false} axisLine={false} className="text-xs" />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                          width={100}
                          className="text-xs"
                        />
                        <Tooltip
                          formatter={(value) => `${(value as number / 100).toFixed(2)} MAD`}
                        />
                        <Bar
                          dataKey="revenue"
                          fill={BLUE}
                          radius={[0, 6, 6, 0]}
                          barSize={20}
                          label={{ position: 'right', style: { fontSize: 10, fill: '#6B7280' } }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3. Balance âgée des créances (cliquable) */}
            <Card className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                  {t('revenue_page.aged_receivables_balance', 'Balance âgée des créances')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {totalReceivables === 0 ? (
                  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                    {t('revenue_page.no_unpaid_receivables', 'Aucune créance impayée')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {agedReceivables.map((item) => {
                      const pct = totalReceivables > 0 ? (item.amount / totalReceivables) * 100 : 0
                      const isClickable = item.amount > 0
                      const mappedRange = item.range === '0-7 jours' ? t('debts.urgency.recent', 'Récent') :
                                          item.range === '8-30 jours' ? t('debts.urgency.old', 'Ancien') :
                                          item.range === '31-60 jours' ? t('debts.urgency.very_old', 'Très ancien') :
                                          item.range === '+60 jours' ? t('debts.urgency.critical', 'Critique') : item.range
                      return (
                        <div
                          key={item.range}
                          className={`space-y-1 transition-opacity ${
                            isClickable ? 'cursor-pointer hover:opacity-80' : 'opacity-50 cursor-default'
                          }`}
                          onClick={() => isClickable && goToInvoicesWithFilter(item.range, item.amount)}
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-300">{mappedRange}</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {formatMAD(item.amount)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: item.color,
                              }}
                            />
                          </div>
                          <p className="text-[10px] text-gray-400 text-right">{pct.toFixed(0)}%</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── TABLEAU DÉTAILLÉ DES TRANSACTIONS ──────────────────── */}
          <Card className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                {t('revenue_page.transaction_details', 'Détail des transactions')}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32 rounded-xl h-8 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs">
                    <SelectValue placeholder={t('revenue_page.status', 'Statut')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('revenue_page.all', 'Tous')}</SelectItem>
                    <SelectItem value="PAID">{t('revenue_page.paid', 'Payée')}</SelectItem>
                    <SelectItem value="PARTIAL">{t('revenue_page.pending', 'En attente')}</SelectItem>
                    <SelectItem value="UNPAID">{t('revenue_page.unpaid', 'Impayée')}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger className="w-32 rounded-xl h-8 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs">
                    <SelectValue placeholder={t('revenue_page.payment_method', 'Paiement')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('revenue_page.all', 'Tous')}</SelectItem>
                    <SelectItem value="cash">{t('revenue_page.cash', 'Espèces')}</SelectItem>
                    <SelectItem value="card">{t('revenue_page.tpe', 'TPE')}</SelectItem>
                    <SelectItem value="mobile">{t('revenue_page.mobile', 'Mobile')}</SelectItem>
                    <SelectItem value="mixed">{t('revenue_page.mixed', 'Mixte')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  {t('revenue_page.no_transactions_period', 'Aucune transaction pour cette période.')}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                          <TableHead className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                            {t('revenue_page.invoice_number', 'N° facture')}
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                            {t('revenue_page.date', 'Date')}
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                            {t('revenue_page.client', 'Client')}
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                            {t('revenue_page.payment_method', 'Paiement')}
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                            {t('revenue_page.status', 'Statut')}
                          </TableHead>
                          <TableHead className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                            {t('revenue_page.amount_ttc', 'Montant TTC')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedTransactions.map((tx) => {
                          const statusColor =
                            tx.status === 'PAID' ? GREEN :
                            tx.status === 'PARTIAL' ? ORANGE : RED
                          const statusLabel =
                            tx.status === 'PAID' ? t('revenue_page.paid', 'Payée') :
                            tx.status === 'PARTIAL' ? t('revenue_page.pending', 'En attente') : t('revenue_page.unpaid', 'Impayée')
                          const paymentLabel: Record<string, string> = {
                            cash: t('revenue_page.cash', 'Espèces'),
                            card: t('revenue_page.tpe', 'TPE'),
                            mobile: t('revenue_page.mobile', 'Mobile'),
                            mixed: t('revenue_page.mixed', 'Mixte'),
                          }
                          return (
                            <TableRow
                              key={tx.id}
                              className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                                tx.isExternal ? 'cursor-default' : 'cursor-pointer'
                              }`}
                              onClick={() => {
                                if (tx.isExternal) return
                                window.location.href = `/dashboard/factures/${tx.id}`
                              }}
                            >
                              <TableCell className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
                                <div className="flex items-center gap-2">
                                  {tx.invoiceNumber}
                                  {tx.isExternal && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-sans border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400"
                                    >
                                      {t('revenue_page.external', 'Externe')}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                {new Date(tx.date).toLocaleDateString('fr-FR')}
                              </TableCell>
                              <TableCell className="text-sm">{tx.client}</TableCell>
                              <TableCell className="text-sm">
                                <Badge variant="outline" className="text-xs border-gray-300 dark:border-gray-600">
                                  {paymentLabel[tx.paymentMethod] || tx.paymentMethod}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className="border-0 text-xs font-medium"
                                  style={{ backgroundColor: statusColor, color: '#ffffff' }}
                                >
                                  {statusLabel}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatMAD(tx.amount)}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={totalItems}
                      pageSize={pageSize}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ─── DIALOG : AJOUTER UN REVENU EXTERNE ─────────────────────── */}
      <Dialog open={addRevenueOpen} onOpenChange={setAddRevenueOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t('revenue_page.add_external_revenue', 'Ajouter un revenu externe')}</DialogTitle>
            <DialogDescription>
              {t('revenue_page.add_external_desc', 'Enregistre un encaissement qui ne provient pas d\'une facture (vente occasionnelle, remboursement, autre revenu...). Ce montant sera ajouté à l\'encaissé (pas au chiffre d\'affaires).')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="amount">{t('revenue_page.amount_label', 'Montant (MAD)')}</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('revenue_page.payment_method', 'Mode de paiement')}</Label>
              <Select value={newPaymentMethod} onValueChange={setNewPaymentMethod}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t('revenue_page.cash', 'Espèces')}</SelectItem>
                  <SelectItem value="card">{t('revenue_page.tpe', 'TPE')}</SelectItem>
                  <SelectItem value="mobile">{t('revenue_page.mobile', 'Mobile')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">{t('revenue_page.description_label', 'Description / motif (optionnel)')}</Label>
              <Input
                id="description"
                placeholder={t('revenue_page.description_placeholder', 'Ex: Vente occasionnelle, remboursement...')}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setAddRevenueOpen(false)}
              disabled={submitting}
            >
              {t('revenue_page.cancel', 'Annuler')}
            </Button>
            <Button
              className="rounded-xl text-white"
              style={{ backgroundColor: BLUE }}
              onClick={handleAddExternalRevenue}
              disabled={submitting}
            >
              {submitting ? t('revenue_page.adding', 'Ajout...') : t('revenue_page.add', 'Ajouter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function RevenusPage() {
  return (
    <Guard permission={PERMISSIONS.FINANCE_REVENUE} redirectTo="/dashboard">
      <RevenusContent />
    </Guard>
  )
}