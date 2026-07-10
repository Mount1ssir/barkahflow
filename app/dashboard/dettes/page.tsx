'use client'

import { Guard } from '@/components/rbac/Guard'
import { PERMISSIONS } from '@/lib/rbac'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { open } from '@tauri-apps/plugin-shell'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
  Search,
  CreditCard,
  Smartphone,
  Wallet,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  MessageSquare,
  X,
} from 'lucide-react'
import {
  getDebtSummary,
  getClientsWithDebt,
  getRecentDebtPayments,
  getAgingBuckets,
  getDebtTrend,
  saveReminder,
  type DebtSummary,
  type ClientDebt,
  type RecentPayment,
  type AgingBucket,
  type DebtTrendPoint,
} from '@/lib/debt-data'
import { formatMAD } from '@/lib/stats-data'
import { recordPaymentForClient } from '@/lib/client-data'
import { getActiveDebtsByClient, type DebtWithInvoice } from '@/lib/debt-ledger'

import {
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

const BLUE = '#3B82F6'
const ORANGE = '#F59E0B'
const RED = '#DC2626'

const URGENCY_LABELS: Record<string, string> = {
  '0-7': 'Récent',
  '8-30': 'Ancien',
  '31-60': 'Très ancien',
  '60+': 'Critique',
}

const NOT_DUE_COLOR = '#3B82F6'

function getDueStatus(client: ClientDebt): { label: string; color: string; isNotDueYet: boolean } {
  const isNotDueYet = !!client.oldestDebtDate && new Date(client.oldestDebtDate).getTime() > Date.now()
  if (isNotDueYet) {
    return { label: 'Non échue', color: NOT_DUE_COLOR, isNotDueYet: true }
  }
  return {
    label: URGENCY_LABELS[client.daysRange] || 'Inconnu',
    color: client.urgencyColor,
    isNotDueYet: false,
  }
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="font-semibold text-gray-900 dark:text-white">
        Dette totale : {formatMAD(payload[0].value)}
      </p>
    </div>
  )
}

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
}

function KpiCard({ title, value, subtitle, icon }: KpiCardProps) {
  return (
    <Card className="rounded-xl border shadow-sm bg-white dark:bg-gray-900" style={{ borderColor: BLUE }}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
            {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}

function Pagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }: PaginationProps) {
  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems)
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-500 dark:text-gray-400">
      <span>Affichage {start} à {end} sur {totalItems} client(s)</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="h-8 w-8 p-0 rounded-xl">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-3 text-sm font-medium">{currentPage} / {totalPages}</span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-8 w-8 p-0 rounded-xl">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Composant interne qui utilise useSearchParams ─────────────────
function DebtManagementContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<DebtSummary | null>(null)
  const [clients, setClients] = useState<ClientDebt[]>([])
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([])
  const [agingBuckets, setAgingBuckets] = useState<AgingBucket[]>([])
  const [trendData, setTrendData] = useState<DebtTrendPoint[]>([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendPeriod, setTrendPeriod] = useState(30)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('amount')
  const [currentPage, setCurrentPage] = useState(1)
  const [clientIdFilter, setClientIdFilter] = useState<string | null>(null)
  const [clientNameFilter, setClientNameFilter] = useState<string | null>(null)
  const pageSize = 5

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientDebt | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null)
  const [debtsList, setDebtsList] = useState<DebtWithInvoice[]>([])

  useEffect(() => {
    // Lire le filtre client depuis l'URL (?client=ID)
    const clientFilter = searchParams.get('client')
    if (clientFilter) {
      setClientIdFilter(clientFilter)
    }
    loadData()
  }, [])

  // Mettre à jour le nom du client filtré une fois les clients chargés
  useEffect(() => {
    if (clientIdFilter && clients.length > 0) {
      const found = clients.find(c => c.clientId === clientIdFilter)
      if (found) setClientNameFilter(found.clientName)
    }
  }, [clientIdFilter, clients])

  // Recherche vocale
  useEffect(() => {
    const handleSearch = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (typeof detail === 'string') setSearch(detail)
    }
    window.addEventListener('barkahflow:search', handleSearch)
    return () => window.removeEventListener('barkahflow:search', handleSearch)
  }, [])

  useEffect(() => {
    const handleClearSearch = () => setSearch('')
    window.addEventListener('barkahflow:clear-search', handleClearSearch)
    return () => window.removeEventListener('barkahflow:clear-search', handleClearSearch)
  }, [])

  useEffect(() => {
    loadTrend(trendPeriod)
  }, [trendPeriod])

  const loadData = async () => {
    setLoading(true)
    try {
      const [s, clientsData, payments, aging, trend] = await Promise.all([
        getDebtSummary(),
        getClientsWithDebt(),
        getRecentDebtPayments(5),
        getAgingBuckets(),
        getDebtTrend(trendPeriod),
      ])
      setSummary(s)
      setClients(clientsData)
      setRecentPayments(payments)
      setAgingBuckets(aging)
      setTrendData(trend)
    } catch (error) {
      console.error(error)
      toast.error('Erreur chargement des données')
    } finally {
      setLoading(false)
    }
  }

  const loadTrend = async (days: number) => {
    setTrendLoading(true)
    try {
      const trend = await getDebtTrend(days)
      setTrendData(trend)
    } catch (error) {
      console.error(error)
    } finally {
      setTrendLoading(false)
    }
  }

  const clearClientFilter = () => {
    setClientIdFilter(null)
    setClientNameFilter(null)
    router.replace('/dashboard/dettes')
  }

  const filteredClients = clients
    .filter((c) => {
      if (clientIdFilter) return c.clientId === clientIdFilter
      return (
        c.clientName.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search) ||
        c.email?.toLowerCase().includes(search.toLowerCase())
      )
    })
    .sort((a, b) => {
      if (sortBy === 'amount') return b.totalDebt - a.totalDebt
      else return b.oldestDebtDays - a.oldestDebtDays
    })

  const totalItems = filteredClients.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const openPaymentDialog = async (client: ClientDebt) => {
    try {
      const debts = await getActiveDebtsByClient(client.clientId)
      if (debts.length === 0) {
        toast.error('Aucune dette active pour ce client')
        return
      }
      setSelectedClient(client)
      setDebtsList(debts)
      setSelectedDebtId(debts[0].debtId)
      setPaymentAmount((client.totalDebt / 100).toFixed(2))
      setPaymentMethod('cash')
      setDialogOpen(true)
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors de la récupération des dettes')
    }
  }

  const handleDebtChange = (debtId: string) => {
    setSelectedDebtId(debtId)
    const debt = debtsList.find(d => d.debtId === debtId)
    if (debt) setPaymentAmount((debt.remainingDebt / 100).toFixed(2))
  }

  const handlePayFull = () => {
    if (selectedDebtId) {
      const debt = debtsList.find(d => d.debtId === selectedDebtId)
      if (debt) setPaymentAmount((debt.remainingDebt / 100).toFixed(2))
    }
  }

  const handleConfirmPayment = async () => {
    if (!selectedClient || !selectedDebtId) {
      toast.error('Client ou dette non sélectionné')
      return
    }
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Montant invalide')
      return
    }
    const amountCents = Math.round(amount * 100)
    const debt = debtsList.find(d => d.debtId === selectedDebtId)
    if (debt && amountCents > debt.remainingDebt) {
      toast.error('Le montant dépasse le solde de la dette sélectionnée')
      return
    }
    try {
      await recordPaymentForClient(selectedClient.clientId, selectedDebtId, amountCents, paymentMethod, null, '', '')
      toast.success(`Paiement de ${formatMAD(amountCents)} enregistré`)
      setDialogOpen(false)
      loadData()
    } catch (error) {
      console.error(error)
      toast.error("Erreur lors de l'enregistrement")
    }
  }

  const handleRappel = async (client: ClientDebt) => {
    const phone = client.phone?.replace(/^0/, '212').replace(/\s/g, '')
    if (!phone) {
      toast.error("Ce client n'a pas de numéro de téléphone")
      return
    }
    const message = `Bonjour ${client.clientName}, vous avez une dette de ${formatMAD(client.totalDebt)} chez nous. Merci de régler dès que possible.`
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    try {
      await open(url)
      await saveReminder(client.clientId, client.totalDebt, message, 'whatsapp')
      toast.success('WhatsApp ouvert, rappel enregistré')
    } catch (error: any) {
      toast.error(`Erreur: ${error?.message || 'Inconnue'}`)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestion des dettes</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Suivez les créances clients, gérez les règlements et anticipez les risques.
        </p>
      </div>

      {/* Bandeau filtre client actif */}
      {clientIdFilter && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-blue-500 shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300 flex-1">
            Affichage filtré pour le client : <strong>{clientNameFilter || clientIdFilter}</strong>
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearClientFilter}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg h-7 px-2 gap-1"
          >
            <X className="h-3.5 w-3.5" /> Effacer le filtre
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Total des dettes en cours" value={summary ? formatMAD(summary.totalDebt) : '0 MAD'} icon={<DollarSign className="h-4 w-4" />} />
            <KpiCard title="Clients endettés" value={summary?.debtorsCount?.toString() || '0'} icon={<Users className="h-4 w-4" />} />
            <KpiCard title="Dette moyenne" value={summary ? formatMAD(summary.averageDebt) : '0 MAD'} icon={<TrendingUp className="h-4 w-4" />} />
            <KpiCard title="Ancienneté de la dette la plus vieille" value={summary ? `${summary.oldestDebtDays} jours` : '0 j'} subtitle="depuis la création, pas l'échéance" icon={<Calendar className="h-4 w-4" />} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Répartition par échéance</CardTitle>
              </CardHeader>
              <CardContent>
                {agingBuckets.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">Aucune dette</div>
                ) : (
                  <div className="space-y-3">
                    {agingBuckets.map((bucket) => (
                      <div key={bucket.range} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-300">{bucket.range}</span>
                          <span className="font-medium text-gray-900 dark:text-white">{formatMAD(bucket.amount)}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${bucket.percentage}%`, backgroundColor: bucket.color }} />
                        </div>
                        <p className="text-[10px] text-gray-400 text-right">{bucket.percentage}%</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Évolution de la dette</CardTitle>
                <Select value={trendPeriod.toString()} onValueChange={(v) => setTrendPeriod(Number(v))}>
                  <SelectTrigger className="w-24 h-8 text-xs rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 jours</SelectItem>
                    <SelectItem value="30">30 jours</SelectItem>
                    <SelectItem value="90">90 jours</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <div className="h-48 relative">
                  {trendLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 z-10 rounded-lg">
                      <span className="text-xs text-gray-400">Chargement...</span>
                    </div>
                  )}
                  {trendData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">Aucune donnée</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ReLineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v / 100).toFixed(0)} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="totalDebt" stroke={BLUE} strokeWidth={2} dot={false} />
                        <Area type="monotone" dataKey="totalDebt" fill={BLUE} fillOpacity={0.1} stroke="none" />
                      </ReLineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                  Clients endettés
                </CardTitle>
                {clientIdFilter && (
                  <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
                    Filtré : {clientNameFilter}
                  </Badge>
                )}
              </div>
              {!clientIdFilter && (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Rechercher..."
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                      className="pl-9 rounded-xl h-9 w-48 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm"
                    />
                  </div>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-40 rounded-xl h-9 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm">
                      <SelectValue placeholder="Trier par" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">Montant décroissant</SelectItem>
                      <SelectItem value="oldest">Retard décroissant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {paginatedClients.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  {clientIdFilter ? 'Aucune dette trouvée pour ce client.' : 'Aucun client endetté ne correspond à la recherche.'}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                          <TableHead className="font-semibold">Client</TableHead>
                          <TableHead className="font-semibold">Téléphone</TableHead>
                          <TableHead className="font-semibold text-right">Montant dû</TableHead>
                          <TableHead className="font-semibold text-center">Factures impayées</TableHead>
                          <TableHead className="font-semibold text-center">Échéance</TableHead>
                          <TableHead className="font-semibold text-center">Date limite</TableHead>
                          <TableHead className="font-semibold text-center">Limite crédit</TableHead>
                          <TableHead className="font-semibold text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedClients.map((client) => {
                          const dueStatus = getDueStatus(client)
                          const isOverdue = !dueStatus.isNotDueYet && client.oldestDebtDays > 0
                          return (
                            <TableRow
                              key={client.clientId}
                              className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer
                                ${isOverdue && client.daysRange === '60+' ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}
                              onClick={() => router.push(`/dashboard/clients/${client.clientId}`)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-medium">
                                    {client.clientName.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-medium">{client.clientName}</span>
                                  {client.overLimit && (
                                    <AlertTriangle className="h-4 w-4 text-red-500" aria-label="Dépasse la limite de crédit" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-gray-500">{client.phone || '-'}</TableCell>
                              <TableCell className="text-right font-bold">{formatMAD(client.totalDebt)}</TableCell>
                              <TableCell className="text-center">{client.unpaidInvoicesCount}</TableCell>
                              <TableCell className="text-center">
                                <Badge style={{ backgroundColor: dueStatus.color, color: '#ffffff', fontWeight: 600 }} className="border-0 px-2.5 py-0.5 text-xs">
                                  {dueStatus.isNotDueYet ? dueStatus.label : `${client.oldestDebtDays} j`}
                                </Badge>
                                {!dueStatus.isNotDueYet && (
                                  <span className="ml-1 text-xs text-gray-400">{dueStatus.label}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center text-sm text-gray-500">
                                {client.oldestDebtDate ? new Date(client.oldestDebtDate).toLocaleDateString('fr-FR') : '—'}
                              </TableCell>
                              <TableCell className="text-center">
                                {client.creditLimit !== null ? (
                                  <span className={`text-xs font-medium ${client.overLimit ? 'text-red-500' : 'text-gray-500'}`}>
                                    {formatMAD(client.creditLimit)}
                                    {client.overLimit && <span className="ml-1 text-red-500">⚠️</span>}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {client.phone && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-xl px-3 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                                      onClick={(e) => { e.stopPropagation(); handleRappel(client) }}
                                      title="Rappel WhatsApp"
                                    >
                                      <MessageSquare className="h-3.5 w-3.5 mr-1" /> WhatsApp
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    style={{ backgroundColor: BLUE }}
                                    className="text-white hover:opacity-90 rounded-xl px-4 text-xs"
                                    onClick={(e) => { e.stopPropagation(); openPaymentDialog(client) }}
                                  >
                                    Régler
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                    <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {recentPayments.length > 0 && (
            <Card className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Règlements récents</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Client</TableHead>
                        <TableHead className="font-semibold text-right">Montant</TableHead>
                        <TableHead className="font-semibold">Mode</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="text-sm">{new Date(payment.date).toLocaleDateString('fr-FR')}</TableCell>
                          <TableCell className="font-medium">{payment.clientName}</TableCell>
                          <TableCell className="text-right font-bold text-green-600">{formatMAD(payment.amount)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs border-gray-300 dark:border-gray-600">
                              {payment.paymentMethod === 'cash' ? 'Espèces' : payment.paymentMethod === 'card' ? 'TPE' : payment.paymentMethod === 'mobile' ? 'Mobile' : payment.paymentMethod}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Enregistrer un paiement</DialogTitle>
            <DialogDescription>
              {selectedClient && (
                <>
                  Client : <span className="font-semibold">{selectedClient.clientName}</span><br />
                  Solde dû total : <span className="font-bold text-blue-600">{formatMAD(selectedClient.totalDebt)}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {debtsList.length > 0 && (
              <div className="space-y-2">
                <Label>Choisir la dette à régler</Label>
                <Select value={selectedDebtId || ''} onValueChange={handleDebtChange}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Sélectionner une dette" /></SelectTrigger>
                  <SelectContent>
                    {debtsList.map((debt) => (
                      <SelectItem key={debt.debtId} value={debt.debtId}>
                        Facture {debt.invoiceNumber} – {formatMAD(debt.remainingDebt)} restant
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="amount">Montant (MAD)</Label>
              <div className="flex gap-2">
                <Input id="amount" type="number" step="0.01" min="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="rounded-xl" />
                <Button type="button" variant="outline" className="rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50" onClick={handlePayFull}>Payer le solde</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mode de paiement</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choisir un mode" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash"><div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-blue-500" /> Espèces</div></SelectItem>
                  <SelectItem value="card"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-blue-500" /> TPE</div></SelectItem>
                  <SelectItem value="mobile"><div className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-blue-500" /> Mobile</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Annuler</Button>
            <Button style={{ backgroundColor: BLUE }} className="text-white hover:opacity-90 rounded-xl" onClick={handleConfirmPayment}>Enregistrer le paiement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Export default avec Suspense (obligatoire pour useSearchParams) ─
export default function DebtManagementPage() {
  return (
    <Guard permission={PERMISSIONS.VIEW_DEBTS} redirectTo="/dashboard">
      <Suspense fallback={<div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>}>
        <DebtManagementContent />
      </Suspense>
    </Guard>
  )
}