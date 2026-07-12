'use client'

import { useEffect, useState, useMemo } from 'react'
import { usePermission } from '@/components/rbac/usePermission'
import { PERMISSIONS } from '@/lib/rbac'
import { Guard } from '@/components/rbac/Guard'
import { useUserContext } from '@/context/UserContext'
import { useTranslation } from 'react-i18next'
import { useRouter, useSearchParams } from 'next/navigation'
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
  DropdownMenuSeparator,
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
  FileText,
  Plus,
  Download,
  Eye,
  Pencil,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Calendar,
  X,
  AlertTriangle,
} from 'lucide-react'
import { getAllInvoices, deleteInvoice, getPendingDebtTotal, type Invoice } from '@/lib/invoice-data'
import { formatMAD } from '@/lib/stats-data'

// ─── Couleurs ──────────────────────────────────────────────────────
const GOLD = '#D4A017'
const PRIMARY = '#2C3E50'

const STATUS_COLORS: Record<string, string> = {
  PAID: '#16A34A',
  PARTIAL: '#F59E0B',
  UNPAID: '#DC2626',
  CANCELLED: '#DC2626',
  DRAFT: '#6B7280',
  CONFIRMED: '#2563EB',
}
const STATUS_LABELS: Record<string, string> = {
  PAID: 'Payée',
  PARTIAL: 'Partielle',
  UNPAID: 'Impayée',
  CANCELLED: 'Annulée',
  DRAFT: 'Brouillon',
  CONFIRMED: 'Confirmée',
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
  const end = Math.min(currentPage * pageSize, totalItems)
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-500 dark:text-gray-400">
      <span>
        {t('invoices.showing', 'Affichage')} {start} à {end} sur {totalItems}{' '}
        {t('invoices.invoices', 'factures')}
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
function InvoicesContent() {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { can } = useUserContext()

  // ─── Vérification des permissions Factures ──────────────────────
  const canView = can(PERMISSIONS.INVOICES_VIEW)
  const canAdd = can(PERMISSIONS.INVOICES_ADD)
  const canEdit = can(PERMISSIONS.INVOICES_EDIT)
  const canDelete = can(PERMISSIONS.INVOICES_DELETE)
  const canExport = can(PERMISSIONS.INVOICES_EXPORT)

  // ─── Si l'utilisateur n'a ni "Voir" ni "Ajouter" ────────────────
  if (!canView && !canAdd) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-7xl mx-auto">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-gray-300 dark:text-zinc-600" />
        </div>
        <p className="font-semibold text-gray-700 dark:text-gray-300">
          {t('invoices.limited_access_title', 'Accès limité aux factures')}
        </p>
        <p className="text-sm text-gray-400 mt-1 max-w-md">
          {t('invoices.limited_access_desc', "Vous n'avez pas les permissions nécessaires pour accéder aux factures.")}
        </p>
      </div>
    )
  }

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [pendingDebt, setPendingDebt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const pageSize = 5

  const urlStatus = searchParams.get('status') || ''
  const urlDateFrom = searchParams.get('dateFrom') || ''
  const urlDateTo = searchParams.get('dateTo') || ''
  const [dateFilter, setDateFilter] = useState('')

  // ── Chargement initial ──
  useEffect(() => {
    loadInvoices()
    const timer = setTimeout(() => setIsLoaded(true), 150)
    return () => clearTimeout(timer)
  }, [])

  // ✅ Recherche vocale
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

  // ✅ Effacer la recherche
  useEffect(() => {
    const handleClearSearch = () => {
      setSearch('')
    }
    window.addEventListener('barkahflow:clear-search', handleClearSearch)
    return () => window.removeEventListener('barkahflow:clear-search', handleClearSearch)
  }, [])

  // ✅ Export CSV
  useEffect(() => {
    const handleExport = () => {
      if (canExport) {
        exportAllCSV()
      } else {
        toast.warning('Vous n\'avez pas la permission d\'exporter')
      }
    }
    window.addEventListener('barkahflow:export', handleExport)
    return () => window.removeEventListener('barkahflow:export', handleExport)
  }, [canExport])

  // ✅ Rafraîchissement après suppression
  useEffect(() => {
    const handleRefresh = () => {
      loadInvoices()
    }
    window.addEventListener('barkahflow:refresh-list', handleRefresh)
    return () => window.removeEventListener('barkahflow:refresh-list', handleRefresh)
  }, [])

  const loadInvoices = async () => {
    try {
      const [data, pending] = await Promise.all([getAllInvoices(), getPendingDebtTotal()])
      setInvoices(data)
      setPendingDebt(pending)
    } catch (error) {
      console.error(error)
      toast.error('Erreur chargement factures')
    } finally {
      setLoading(false)
    }
  }

  const filteredData = useMemo(() => {
    let data = invoices
    if (search.trim()) {
      const q = search.toLowerCase()
      data = data.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.clientName?.toLowerCase().includes(q)
      )
    }
    if (urlStatus && urlStatus !== 'all') {
      data = data.filter((inv) => inv.status === urlStatus)
    }
    if (urlDateFrom && urlDateTo) {
      data = data.filter((inv) => {
        const invDate = inv.createdAt.split('T')[0]
        return invDate >= urlDateFrom && invDate <= urlDateTo
      })
    }
    if (dateFilter) {
      const selectedDate = new Date(dateFilter)
      data = data.filter((inv) => {
        const invDate = new Date(inv.createdAt)
        return (
          invDate.getFullYear() === selectedDate.getFullYear() &&
          invDate.getMonth() === selectedDate.getMonth() &&
          invDate.getDate() === selectedDate.getDate()
        )
      })
    }
    return data
  }, [invoices, search, urlStatus, urlDateFrom, urlDateTo, dateFilter])

  const totalItems = filteredData.length
  const totalPages = Math.ceil(totalItems / pageSize)
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, currentPage, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, urlStatus, urlDateFrom, urlDateTo, dateFilter])

  // ─── KPI ──────────────────────────────────────────────────────
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.total, 0)
  const paidTotal = invoices.filter((inv) => inv.status === 'PAID').reduce((sum, inv) => sum + inv.total, 0)
  const unpaidTotal = invoices.filter((inv) => inv.status === 'UNPAID').reduce((sum, inv) => sum + inv.total, 0)
  const pendingTotal = pendingDebt
  const denominator = totalAmount || 1
  const paidPercent = (paidTotal / denominator) * 100
  const pendingPercent = (pendingTotal / denominator) * 100
  const unpaidPercent = (unpaidTotal / denominator) * 100

  const kpiData = [
    { label: t('invoices.total_invoiced', 'Total facturé'), value: formatMAD(totalAmount), icon: <FileText className="h-5 w-5" />, iconBg: 'bg-blue-50 dark:bg-blue-900/20', iconColor: PRIMARY, progress: 100, barColor: GOLD },
    { label: t('invoices.paid_total', 'Payées'), value: formatMAD(paidTotal), icon: <FileText className="h-5 w-5" />, iconBg: 'bg-green-50 dark:bg-green-900/20', iconColor: '#16A34A', progress: paidPercent, barColor: '#16A34A' },
    { label: t('invoices.pending_total', 'En attente'), value: formatMAD(pendingTotal), icon: <FileText className="h-5 w-5" />, iconBg: 'bg-amber-50 dark:bg-amber-900/20', iconColor: '#F59E0B', progress: pendingPercent, barColor: '#F59E0B' },
    { label: t('invoices.unpaid_total', 'Impayées'), value: formatMAD(unpaidTotal), icon: <FileText className="h-5 w-5" />, iconBg: 'bg-red-50 dark:bg-red-900/20', iconColor: '#DC2626', progress: unpaidPercent, barColor: '#DC2626' },
  ]

  // ─── Sélection ────────────────────────────────────────────────
  const toggleSelectAll = (checked: boolean) => setSelectedIds(checked ? paginatedData.map((inv) => inv.id) : [])
  const toggleSelect = (id: string) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id])
  const isAllSelected = paginatedData.length > 0 && paginatedData.every((inv) => selectedIds.includes(inv.id))

  // ─── Actions ──────────────────────────────────────────────────
  const handleView = (invoice: Invoice) => {
    if (canView) {
      router.push(`/dashboard/factures/${invoice.id}`)
    }
  }
  const handleEdit = (id: string) => {
    if (canEdit) {
      router.push(`/dashboard/factures/${id}/edit`)
    }
  }

  const handleDeleteSelected = async () => {
    if (!canDelete) {
      toast.warning('Vous n\'avez pas la permission de supprimer')
      return
    }
    if (selectedIds.length === 0) return
    try {
      await Promise.all(selectedIds.map((id) => deleteInvoice(id)))
      toast.success(t('invoices.bulk_deleted', { count: selectedIds.length }))
      setSelectedIds([])
      loadInvoices()
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !canDelete) return
    try {
      await deleteInvoice(deleteTarget.id)
      toast.success(t('invoices.deleted', { number: deleteTarget.invoiceNumber }))
      setDeleteTarget(null)
      loadInvoices()
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  const exportAllCSV = () => {
    if (!canExport) {
      toast.warning('Vous n\'avez pas la permission d\'exporter')
      return
    }
    const headers = [t('invoices.col_number','N° facture'), t('invoices.col_client','Client'), t('invoices.col_date','Date'), t('invoices.col_due','Échéance'), t('invoices.col_status','Statut'), t('invoices.col_ht','Total HT'), t('invoices.col_ttc','Total TTC')]
    const rows = filteredData.map((inv) => [
      inv.invoiceNumber,
      inv.clientName || 'Client de passage',
      new Date(inv.createdAt).toLocaleDateString('fr-FR'),
      inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('fr-FR') : '—',
      t('invoices.status_' + inv.status.toLowerCase(), STATUS_LABELS[inv.status] || inv.status),
      (inv.subtotal / 100).toFixed(2),
      (inv.total / 100).toFixed(2),
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `factures_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    toast.success(t('common.export_done', 'Export terminé'))
  }

  const exportSelected = () => {
    if (!canExport) {
      toast.warning('Vous n\'avez pas la permission d\'exporter')
      return
    }
    const selectedInvoices = invoices.filter((inv) => selectedIds.includes(inv.id))
    if (selectedInvoices.length === 0) return
    const headers = [t('invoices.col_number','N° facture'), t('invoices.col_client','Client'), t('invoices.col_date','Date'), t('invoices.col_due','Échéance'), t('invoices.col_status','Statut'), t('invoices.col_ht','Total HT'), t('invoices.col_ttc','Total TTC')]
    const rows = selectedInvoices.map((inv) => [
      inv.invoiceNumber,
      inv.clientName || 'Client de passage',
      new Date(inv.createdAt).toLocaleDateString('fr-FR'),
      inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('fr-FR') : '—',
      t('invoices.status_' + inv.status.toLowerCase(), STATUS_LABELS[inv.status] || inv.status),
      (inv.subtotal / 100).toFixed(2),
      (inv.total / 100).toFixed(2),
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `factures_selection_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    toast.success(t('common.export_done', 'Export terminé'))
  }

  const isWalkInClient = (clientName: string | null, clientId: string | null): boolean => {
    if (clientId === 'client_walkin') return true
    if (clientName) {
      const lower = clientName.toLowerCase()
      return lower.includes('passage') || lower.includes('عابر')
    }
    return false
  }

  const resetUrlFilters = () => router.push('/dashboard/factures')
  const hasActiveFilters = !!(urlStatus || urlDateFrom || urlDateTo)

  const getDueDateInfo = (inv: Invoice) => {
    if (!inv.dueDate) return { label: '—', isOverdue: false }
    const due = new Date(inv.dueDate)
    const isOverdue = (inv.status === 'UNPAID' || inv.status === 'PARTIAL') && due.getTime() < Date.now()
    return { label: due.toLocaleDateString('fr-FR'), isOverdue }
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('invoices.title', 'Factures')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {t('invoices.subtitle', 'Gérez vos factures, suivez les paiements et vos relances.')}
        </p>
      </div>

      {hasActiveFilters && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {urlStatus === 'UNPAID' && t('invoices.unpaid_invoices', 'Factures impayées')}
            {urlDateFrom && urlDateTo && ` — du ${new Date(urlDateFrom).toLocaleDateString('fr-FR')} au ${new Date(urlDateTo).toLocaleDateString('fr-FR')}`}
          </span>
          <Button variant="ghost" size="sm" onClick={resetUrlFilters} className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 gap-1">
            <X className="h-4 w-4" /> {t('common.reset', 'Réinitialiser')}
          </Button>
        </div>
      )}

      {/* ─── KPI ────────────────────────────────────────────────────── */}
      {/* Les KPI sont visibles uniquement si l'utilisateur a "Voir" */}
      {canView && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiData.map((kpi, index) => (
            <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} icon={kpi.icon} iconBg={kpi.iconBg} iconColor={kpi.iconColor} progress={kpi.progress} barColor={kpi.barColor} delay={index * 100} isLoaded={isLoaded} />
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
              <Input placeholder={t('invoices.search', 'Rechercher...')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-10" />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="pl-9 rounded-xl bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-10 w-48" />
            </div>
            {dateFilter && (
              <Button variant="ghost" size="sm" onClick={() => setDateFilter('')} className="text-gray-400 hover:text-gray-600">
                ✕ Effacer
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">{totalItems}</span>
            {selectedIds.length > 0 && canDelete && (
              <Button variant="outline" size="sm" className="gap-2 rounded-xl h-9 border-red-200 text-red-600 hover:bg-red-50" onClick={handleDeleteSelected}>
                <Trash2 className="h-4 w-4" /> Supprimer ({selectedIds.length})
              </Button>
            )}
            {selectedIds.length > 0 && canExport && (
              <Button variant="outline" size="sm" className="gap-2 rounded-xl h-9 border-gray-200" onClick={exportSelected}>
                <Download className="h-4 w-4" /> {t('invoices.export_selection', 'Exporter sélection')}
              </Button>
            )}
            {canExport && (
              <Button variant="outline" className="gap-2 rounded-xl h-10 border-gray-200" onClick={exportAllCSV}>
                <Download className="h-4 w-4" /> {t('invoices.export', 'Exporter')}
              </Button>
            )}
            {canAdd && (
              <Button className="gap-2 rounded-xl h-10 text-white font-semibold shadow-sm hover:shadow-md transition-all" style={{ backgroundColor: PRIMARY }} onClick={() => router.push('/dashboard/caisse')}>
                <Plus className="h-4 w-4" /> {t('invoices.new', 'Nouvelle facture')}
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
              <FileText className="h-12 w-12 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Vous n'avez pas la permission de voir les factures.</p>
              {canAdd && (
                <Button className="gap-2 rounded-xl h-10 text-white font-semibold mt-4" style={{ backgroundColor: PRIMARY }} onClick={() => router.push('/dashboard/caisse')}>
                  <Plus className="h-4 w-4" /> Nouvelle facture
                </Button>
              )}
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">{t('invoices.no_data', 'Aucune facture')}</p>
              {canAdd && (
                <Button className="gap-2 rounded-xl h-10 text-white font-semibold mt-4" style={{ backgroundColor: PRIMARY }} onClick={() => router.push('/dashboard/caisse')}>
                  <Plus className="h-4 w-4" /> Nouvelle facture
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
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{t('invoices.number', 'N° facture')}</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{t('invoices.client', 'Client')}</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{t('invoices.date', 'Date')}</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{t('invoices.col_due', 'Échéance')}</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{t('invoices.status', 'Statut')}</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">{t('invoices.total_ht', 'Total HT')}</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">{t('invoices.total_ttc', 'Total TTC')}</TableHead>
                    <TableHead className="w-12 text-right font-semibold text-gray-700 dark:text-gray-300">{t('invoices.actions', 'Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((inv) => {
                    const isSelected = selectedIds.includes(inv.id)
                    const statusColor = STATUS_COLORS[inv.status] || '#6B7280'
                    const statusLabel = t('invoices.status_' + inv.status.toLowerCase(), STATUS_LABELS[inv.status] || inv.status)
                    const isWalkin = isWalkInClient(inv.clientName, inv.clientId)
                    const clientDisplay = isWalkin ? t('pos.walkin_client', 'Client de passage') : inv.clientName || t('invoices.anonymous', 'Anonyme')
                    const dueDateInfo = getDueDateInfo(inv)
                    return (
                      <TableRow key={inv.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                        <TableCell><Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(inv.id)} /></TableCell>
                        <TableCell className="font-mono text-sm font-bold" style={{ color: PRIMARY }}>{inv.invoiceNumber}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
                              {clientDisplay.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm">{clientDisplay}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{new Date(inv.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell className="text-sm">
                          {dueDateInfo.isOverdue ? (
                            <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                              <AlertTriangle className="h-3.5 w-3.5" /> {dueDateInfo.label}
                            </span>
                          ) : (
                            <span className="text-gray-500">{dueDateInfo.label}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge style={{ backgroundColor: statusColor, color: '#ffffff' }} className="border-0 font-medium px-2.5 py-0.5 text-xs flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/80" /> {statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-gray-500">{formatMAD(inv.subtotal)}</TableCell>
                        <TableCell className="text-right font-medium text-gray-900 dark:text-white">{formatMAD(inv.total)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              {canView && (
                                <DropdownMenuItem onClick={() => handleView(inv)} className="gap-2">
                                  <Eye className="h-4 w-4" /> {t('common.view', 'Voir')}
                                </DropdownMenuItem>
                              )}
                              {canEdit && (
                                <DropdownMenuItem onClick={() => handleEdit(inv.id)} className="gap-2">
                                  <Pencil className="h-4 w-4" /> {t('common.edit', 'Modifier')}
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setDeleteTarget(inv)} className="gap-2 text-red-500">
                                    <Trash2 className="h-4 w-4" /> {t('common.delete', 'Supprimer')}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              {t('invoices.delete_confirm', { number: deleteTarget?.invoiceNumber })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function InvoicesPage() {
  return (
    <Guard permission={PERMISSIONS.INVOICES_ACCESS} redirectTo="/dashboard">
      <InvoicesContent />
    </Guard>
  )
}