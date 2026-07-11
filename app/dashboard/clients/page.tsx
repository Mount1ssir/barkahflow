'use client'

import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import { useUserContext } from '@/context/UserContext'
import { PERMISSIONS } from '@/lib/rbac'
import { Guard } from '@/components/rbac/Guard'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Search,
  Plus,
  Download,
  Eye,
  Pencil,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Users,
  UserCheck,
  CreditCard,
  AlertTriangle,
} from 'lucide-react'
import { getAllClients, deleteClient, type Client } from '@/lib/client-data'
import { formatMAD } from '@/lib/stats-data'

// ─── Couleurs ──────────────────────────────────────────────────────
const GOLD = '#D4A017'
const PRIMARY = '#2C3E50'

// ─── Score de fidélité ─────────────────────────────────────────────
type FidelityScore = 'vip' | 'fidele' | 'nouveau' | 'inactif'

interface ScoreConfig {
  label: string
  bg: string
  color: string
  border: string
}

const SCORE_CONFIG: Record<FidelityScore, ScoreConfig> = {
  vip:     { label: 'VIP',     bg: 'rgba(212,160,23,0.1)',  color: '#92400E', border: 'rgba(212,160,23,0.35)' },
  fidele:  { label: 'Fidèle',  bg: 'rgba(34,197,94,0.08)', color: '#166534', border: 'rgba(34,197,94,0.25)'  },
  nouveau: { label: 'Nouveau', bg: 'rgba(59,130,246,0.08)',color: '#1d4ed8', border: 'rgba(59,130,246,0.25)' },
  inactif: { label: 'Inactif', bg: 'rgba(239,68,68,0.07)', color: '#991B1B', border: 'rgba(239,68,68,0.2)'  },
}

function computeScore(client: Client): FidelityScore {
  const count        = client.invoiceCount || 0
  const totalSpent   = client.totalSpent   || 0
  const lastInvoice  = client.lastInvoiceDate ? new Date(client.lastInvoiceDate) : null
  const daysSinceLast = lastInvoice ? (Date.now() - lastInvoice.getTime()) / (1000 * 60 * 60 * 24) : Infinity
  if (count >= 10 || totalSpent >= 100000) return 'vip'
  if (count > 0 && daysSinceLast > 30)     return 'inactif'
  if (count >= 3)                           return 'fidele'
  return 'nouveau'
}

function FidelityBadge({ client }: { client: Client }) {
  const score  = computeScore(client)
  const config = SCORE_CONFIG[score]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 9px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: 600,
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: config.color, display: 'inline-block' }} />
      {config.label}
    </span>
  )
}

// ─── KPI ──────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string
  value: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  progress: number
  barColor: string
  delay: number
  isLoaded: boolean
}

function KpiCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  progress,
  barColor,
  delay,
  isLoaded,
}: KpiCardProps) {
  const pct = Math.min(100, Math.max(0, progress))
  return (
    <Card
      className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm transition-all duration-700 ease-out"
      style={{
        transform: isLoaded ? 'translateY(0)' : 'translateY(-40px)',
        opacity: isLoaded ? 1 : 0,
        transitionDelay: `${delay}ms`,
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
            <span style={{ color: iconColor }}>{icon}</span>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: isLoaded ? `${pct}%` : '0%',
              backgroundColor: barColor,
              transitionDelay: `${delay + 200}ms`,
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Pagination ──────────────────────────────────────────────────
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
  const end   = Math.min(currentPage * pageSize, totalItems)
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-500 dark:text-gray-400">
      <span>
        {t('clients.showing', 'Affichage')} {start} à {end} sur {totalItems} {t('clients.clients', 'clients')}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1} className="h-8 w-8 p-0 rounded-xl">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-3 text-sm font-medium">{currentPage} / {totalPages}</span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages} className="h-8 w-8 p-0 rounded-xl">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Page principale ─────────────────────────────────────────────
function ClientsContent() {
  const { t }    = useTranslation()
  const router   = useRouter()
  const { can }  = useUserContext()

  // ─── Vérification des permissions Clients ──────────────────────
  const canView = can(PERMISSIONS.CLIENTS_VIEW)
  const canAdd = can(PERMISSIONS.CLIENTS_ADD)
  const canEdit = can(PERMISSIONS.CLIENTS_EDIT)
  const canDelete = can(PERMISSIONS.CLIENTS_DELETE)
  const canExport = can(PERMISSIONS.CLIENTS_EXPORT)

  // ─── Si l'utilisateur n'a ni "Voir" ni "Ajouter" ────────────────
  if (!canView && !canAdd) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-7xl mx-auto">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-gray-300 dark:text-zinc-600" />
        </div>
        <p className="font-semibold text-gray-700 dark:text-gray-300">
          Accès limité aux clients
        </p>
        <p className="text-sm text-gray-400 mt-1 max-w-md">
          Vous n'avez pas les permissions nécessaires pour accéder aux clients.
        </p>
      </div>
    )
  }

  // ─── Reste du code ──────────────────────────────────────────────
  const [clients, setClients]           = useState<Client[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [debtFilter, setDebtFilter]     = useState('all')
  const [scoreFilter, setScoreFilter]   = useState('all')
  const [selectedIds, setSelectedIds]   = useState<string[]>([])
  const [currentPage, setCurrentPage]   = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)
  const [isLoaded, setIsLoaded]         = useState(false)
  const pageSize = 5

  // ── Chargement initial ──
  useEffect(() => {
    loadClients()
    const timer = setTimeout(() => setIsLoaded(true), 150)
    return () => clearTimeout(timer)
  }, [])

  // ── Recherche vocale ──
  useEffect(() => {
    const handleSearch = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (typeof detail === 'string') {
        setSearch(detail)
      }
    }
    window.addEventListener('barkahflow:search', handleSearch)
    return () => window.removeEventListener('barkahflow:search', handleSearch)
  }, [])

  // ── Effacer la recherche ──
  useEffect(() => {
    const handleClearSearch = () => {
      setSearch('')
    }
    window.addEventListener('barkahflow:clear-search', handleClearSearch)
    return () => window.removeEventListener('barkahflow:clear-search', handleClearSearch)
  }, [])

  // ── Export ──
  useEffect(() => {
    const handleExport = () => {
      if (canExport) {
        exportCSV()
      } else {
        toast.warning('Vous n\'avez pas la permission d\'exporter')
      }
    }
    window.addEventListener('barkahflow:export', handleExport)
    return () => window.removeEventListener('barkahflow:export', handleExport)
  }, [canExport])

  // ── Rafraîchissement ──
  useEffect(() => {
    const handleRefresh = () => {
      loadClients()
    }
    window.addEventListener('barkahflow:refresh-list', handleRefresh)
    return () => window.removeEventListener('barkahflow:refresh-list', handleRefresh)
  }, [])

  const loadClients = async () => {
    try {
      const data = await getAllClients()
      setClients(data)
    } catch (error) {
      console.error(error)
      toast.error('Erreur chargement clients')
    } finally {
      setLoading(false)
    }
  }

  const filteredData = useMemo(() => {
    let data = clients
    if (search.trim()) {
      const q = search.toLowerCase()
      data = data.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      )
    }
    if (debtFilter === 'with_debt')    data = data.filter((c) => c.debt > 0)
    if (debtFilter === 'without_debt') data = data.filter((c) => c.debt === 0)
    if (scoreFilter !== 'all') {
      data = data.filter((c) => computeScore(c) === scoreFilter)
    }
    return data
  }, [clients, search, debtFilter, scoreFilter])

  const totalItems  = filteredData.length
  const totalPages  = Math.ceil(totalItems / pageSize)
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, currentPage, pageSize])

  useEffect(() => { setCurrentPage(1) }, [search, debtFilter, scoreFilter])

  // ─── KPI ──────────────────────────────────────────────────────
  const totalClients = clients.length
  const activeClients = clients.filter((c) => c.debt === 0).length
  const totalDebt     = clients.reduce((sum, c) => sum + c.debt, 0)
  const debtors       = clients.filter((c) => c.debt > 0).length

  const progressTotal    = 100
  const progressActive   = totalClients > 0 ? (activeClients / totalClients) * 100 : 0
  const progressDebt     = totalDebt > 0 ? 100 : 0
  const progressDebtors  = totalClients > 0 ? (debtors / totalClients) * 100 : 0

  const kpiProgress = [
    { progress: progressTotal,    barColor: GOLD },
    { progress: progressActive,   barColor: '#16A34A' },
    { progress: progressDebt,     barColor: '#F59E0B' },
    { progress: progressDebtors,  barColor: '#DC2626' },
  ]

  const kpiData = [
    { label: t('clients.total', 'Total clients'),    value: String(totalClients),  icon: <Users className="h-5 w-5" />,         iconBg: 'bg-blue-50 dark:bg-blue-900/20',   iconColor: PRIMARY },
    { label: t('clients.active', 'Clients actifs'),  value: String(activeClients), icon: <UserCheck className="h-5 w-5" />,      iconBg: 'bg-green-50 dark:bg-green-900/20', iconColor: '#16A34A' },
    { label: t('clients.total_debt', 'Dettes'),      value: formatMAD(totalDebt),  icon: <CreditCard className="h-5 w-5" />,     iconBg: 'bg-amber-50 dark:bg-amber-900/20', iconColor: '#F59E0B' },
    { label: t('clients.debtors', 'Endettés'),       value: String(debtors),       icon: <AlertTriangle className="h-5 w-5" />,  iconBg: 'bg-red-50 dark:bg-red-900/20',     iconColor: '#DC2626' },
  ]

  // ─── Sélection ────────────────────────────────────────────────
  const toggleSelectAll = (checked: boolean) => setSelectedIds(checked ? paginatedData.map((c) => c.id) : [])
  const toggleSelect    = (id: string) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id])
  const isAllSelected   = paginatedData.length > 0 && paginatedData.every((c) => selectedIds.includes(c.id))

  // ─── Actions ──────────────────────────────────────────────────
  const handleView = (client: Client) => {
    if (canView) {
      router.push(`/dashboard/clients/${client.id}`)
    }
  }
  const handleEdit = (id: string) => {
    if (canEdit) {
      router.push(`/dashboard/clients/${id}/edit`)
    }
  }

  const handleDeleteSelected = async () => {
    if (!canDelete) {
      toast.warning('Vous n\'avez pas la permission de supprimer')
      return
    }
    if (selectedIds.length === 0) return
    try {
      await Promise.all(selectedIds.map((id) => deleteClient(id)))
      toast.success(`${selectedIds.length} client(s) supprimé(s)`)
      setSelectedIds([])
      loadClients()
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !canDelete) return
    try {
      await deleteClient(deleteTarget.id)
      toast.success(`Client ${deleteTarget.fullName} supprimé`)
      setDeleteTarget(null)
      loadClients()
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  // ─── Export CSV ──────────────────────────────────────────────
  const exportCSV = () => {
    if (!canExport) {
      toast.warning('Vous n\'avez pas la permission d\'exporter')
      return
    }
    const headers = ['Nom', 'Téléphone', 'Email', 'Adresse', 'Dette', 'Factures', 'Score', 'Date création']
    const rows = filteredData.map((c) => [
      c.fullName,
      c.phone || '',
      c.email || '',
      c.address || '',
      (c.debt / 100).toFixed(2),
      c.invoiceCount || 0,
      computeScore(c),
      new Date(c.createdAt).toLocaleDateString('fr-FR'),
    ])
    const csv  = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href  = URL.createObjectURL(blob)
    link.download = `clients_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    toast.success('Export terminé')
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">

      {/* ─── Titre + sous-titre ─── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('clients.title', 'Clients')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {t('clients.subtitle', 'Gérez vos clients, suivez leurs achats et leurs fidélités.')}
        </p>
      </div>

      {/* ─── KPI ────────────────────────────────────────────────────── */}
      {/* Les KPI sont visibles uniquement si l'utilisateur a "Voir" */}
      {canView && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiData.map((kpi, index) => (
            <KpiCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              iconBg={kpi.iconBg}
              iconColor={kpi.iconColor}
              progress={kpiProgress[index].progress}
              barColor={kpiProgress[index].barColor}
              delay={index * 100}
              isLoaded={isLoaded}
            />
          ))}
        </div>
      )}

      {/* ─── Toolbar ────────────────────────────────────────────────── */}
      {/* La toolbar est visible uniquement si l'utilisateur a "Voir" */}
      {canView && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t('clients.search', 'Rechercher...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-xl bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-10"
              />
            </div>

            <Select value={debtFilter} onValueChange={setDebtFilter}>
              <SelectTrigger className="w-40 rounded-xl h-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <SelectValue placeholder="Filtre dette" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="with_debt">Avec dette</SelectItem>
                <SelectItem value="without_debt">Sans dette</SelectItem>
              </SelectContent>
            </Select>

            <Select value={scoreFilter} onValueChange={setScoreFilter}>
              <SelectTrigger className="w-40 rounded-xl h-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <SelectValue placeholder="Score fidélité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les scores</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
                <SelectItem value="fidele">Fidèle</SelectItem>
                <SelectItem value="nouveau">Nouveau</SelectItem>
                <SelectItem value="inactif">Inactif</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">{totalItems}</span>
            {selectedIds.length > 0 && canDelete && (
              <Button variant="outline" size="sm"
                className="gap-2 rounded-xl h-9 border-red-200 text-red-600 hover:bg-red-50"
                onClick={handleDeleteSelected}>
                <Trash2 className="h-4 w-4" /> Supprimer ({selectedIds.length})
              </Button>
            )}
            {canExport && (
              <Button variant="outline" className="gap-2 rounded-xl h-10 border-gray-200" onClick={exportCSV}>
                <Download className="h-4 w-4" /> {t('clients.export', 'Exporter')}
              </Button>
            )}
            {canAdd && (
              <Button className="gap-2 rounded-xl h-10 text-white font-medium shadow-sm hover:shadow-md transition-all" style={{ backgroundColor: PRIMARY }}
                onClick={() => router.push('/dashboard/clients/nouveau')}>
                <Plus className="h-4 w-4" /> {t('clients.add', 'Ajouter client')}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ─── Table ───────────────────────────────────────────────────── */}
      <Card className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !canView ? (
            // Si l'utilisateur n'a pas "Voir" mais a "Ajouter"
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500">Vous n'avez pas la permission de voir les clients.</p>
              {canAdd && (
                <Button className="gap-2 rounded-xl h-10 text-white font-medium mt-4" style={{ backgroundColor: PRIMARY }}
                  onClick={() => router.push('/dashboard/clients/nouveau')}>
                  <Plus className="h-4 w-4" /> Ajouter un client
                </Button>
              )}
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500">{t('clients.no_data', 'Aucun client')}</p>
              {canAdd && (
                <Button className="gap-2 rounded-xl h-10 text-white font-medium mt-4" style={{ backgroundColor: PRIMARY }}
                  onClick={() => router.push('/dashboard/clients/nouveau')}>
                  <Plus className="h-4 w-4" /> Ajouter un client
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                    <TableHead className="w-10">
                      <Checkbox checked={isAllSelected} onCheckedChange={toggleSelectAll} />
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Client</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Score</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Téléphone</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Email</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Factures</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">Dette</TableHead>
                    <TableHead className="w-12 text-right font-semibold text-gray-700 dark:text-gray-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((client) => {
                    const isSelected = selectedIds.includes(client.id)
                    const hasDebt    = client.debt > 0
                    const debtColor  = hasDebt ? '#DC2626' : '#6B7280'
                    const debtLabel  = hasDebt ? formatMAD(client.debt) : '0 MAD'
                    return (
                      <TableRow
                        key={client.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                      >
                        <TableCell>
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(client.id)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-500 dark:text-gray-300">
                              {client.fullName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium">{client.fullName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <FidelityBadge client={client} />
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 dark:text-gray-400">{client.phone || '-'}</TableCell>
                        <TableCell className="text-sm text-gray-500 dark:text-gray-400">{client.email || '-'}</TableCell>
                        <TableCell className="text-sm font-medium">{client.invoiceCount || 0}</TableCell>
                        <TableCell className="text-right">
                          <Badge style={{ backgroundColor: debtColor, color: '#ffffff' }}
                            className="border-0 font-medium px-2.5 py-0.5 text-xs">
                            {debtLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canView && (
                              <button
                                onClick={() => handleView(client)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                title="Voir le client"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => handleEdit(client.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                title="Modifier le client"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {(canDelete || canExport) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl">
                                  {canDelete && (
                                    <DropdownMenuItem onClick={() => setDeleteTarget(client)}
                                      className="gap-2 text-red-500 focus:text-red-500">
                                      <Trash2 className="h-4 w-4" /> Supprimer
                                    </DropdownMenuItem>
                                  )}
                                  {canExport && (
                                    <DropdownMenuItem onClick={() => {
                                      // Exporter un seul client en CSV
                                      const headers = ['Nom', 'Téléphone', 'Email', 'Adresse', 'Dette', 'Factures', 'Score']
                                      const row = [
                                        client.fullName,
                                        client.phone || '',
                                        client.email || '',
                                        client.address || '',
                                        (client.debt / 100).toFixed(2),
                                        client.invoiceCount || 0,
                                        computeScore(client),
                                      ]
                                      const csv = [headers.join(','), row.join(',')].join('\n')
                                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                                      const link = document.createElement('a')
                                      link.href = URL.createObjectURL(blob)
                                      link.download = `client_${client.fullName}_${new Date().toISOString().slice(0, 10)}.csv`
                                      link.click()
                                      URL.revokeObjectURL(link.href)
                                      toast.success('Client exporté')
                                    }} className="gap-2">
                                      <Download className="h-4 w-4" /> Exporter
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                <Pagination currentPage={currentPage} totalPages={totalPages}
                  totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Dialog suppression ─── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {deleteTarget?.fullName} ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}

export default function ClientsPage() {
  return (
    <Guard permission={PERMISSIONS.CLIENTS_ACCESS} redirectTo="/dashboard">
      <ClientsContent />
    </Guard>
  )
}