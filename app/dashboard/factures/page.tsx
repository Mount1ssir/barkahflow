'use client'

import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
  Home,
  ChevronRight as ChevronRightIcon,
  Trash2,
  Calendar,
} from 'lucide-react'
import { getAllInvoices, deleteInvoice, type Invoice } from '@/lib/invoice-data'
import { formatMAD } from '@/lib/stats-data'

// ─── Couleurs ──────────────────────────────────────────────────────
const GOLD = '#D4A017'
const DARK_BLUE = '#1D4ED8'
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
  color: string
  progress: number
}

function KpiCard({ label, value, color, progress }: KpiCardProps) {
  return (
    <Card className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
      <CardContent className="p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        <div className="mt-3 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: color }}
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
        {t('invoices.showing', 'Affichage')} {start} à {end} sur {totalItems} {t('invoices.invoices', 'factures')}
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

// ─── Page principale ─────────────────────────────────────────────
export default function InvoicesPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('') // format "YYYY-MM-DD"
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null)
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null)
  const pageSize = 5

  useEffect(() => { loadInvoices() }, [])

  const loadInvoices = async () => {
    try {
      const data = await getAllInvoices()
      setInvoices(data)
    } catch (error) {
      console.error(error)
      toast.error('Erreur chargement factures')
    } finally {
      setLoading(false)
    }
  }

  // Filtrage : recherche + date
  const filteredData = useMemo(() => {
    let data = invoices

    // Recherche textuelle
    if (search.trim()) {
      const q = search.toLowerCase()
      data = data.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.clientName?.toLowerCase().includes(q)
      )
    }

    // Filtre par date (si une date est saisie)
    if (dateFilter) {
      const selectedDate = new Date(dateFilter)
      // On compare uniquement l'année, mois, jour
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
  }, [invoices, search, dateFilter])

  const totalItems = filteredData.length
  const totalPages = Math.ceil(totalItems / pageSize)
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, currentPage, pageSize])

  useEffect(() => { setCurrentPage(1) }, [search, dateFilter])

  // ─── KPI ──────────────────────────────────────────────────────
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.total, 0)
  const paidTotal = invoices.filter((inv) => inv.status === 'PAID').reduce((sum, inv) => sum + inv.total, 0)
  const partialTotal = invoices.filter((inv) => inv.status === 'PARTIAL').reduce((sum, inv) => sum + inv.total, 0)
  const unpaidTotal = invoices.filter((inv) => inv.status === 'UNPAID').reduce((sum, inv) => sum + inv.total, 0)

  const maxTotal = Math.max(paidTotal, partialTotal, unpaidTotal, 1)
  const paidPercent = (paidTotal / maxTotal) * 100
  const partialPercent = (partialTotal / maxTotal) * 100
  const unpaidPercent = (unpaidTotal / maxTotal) * 100

  const kpiData = [
    { label: t('invoices.total_invoiced', 'Total facturé'), value: formatMAD(totalAmount), color: GOLD, progress: 100 },
    { label: t('invoices.paid_total', 'Payées'), value: formatMAD(paidTotal), color: '#16A34A', progress: paidPercent },
    { label: t('invoices.partial_total', 'En attente'), value: formatMAD(partialTotal), color: '#F59E0B', progress: partialPercent },
    { label: t('invoices.unpaid_total', 'Impayées'), value: formatMAD(unpaidTotal), color: '#DC2626', progress: unpaidPercent },
  ]

  // ─── Sélection ────────────────────────────────────────────────
  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? paginatedData.map((inv) => inv.id) : [])
  }
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id])
  }
  const isAllSelected = paginatedData.length > 0 && paginatedData.every((inv) => selectedIds.includes(inv.id))

  // ─── Actions ──────────────────────────────────────────────────
  const handleView = (invoice: Invoice) => { setViewingInvoice(invoice) }
  const handleEdit = (id: string) => { router.push(`/dashboard/factures/${id}/edit`) }

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    try {
      await Promise.all(selectedIds.map((id) => deleteInvoice(id)))
      toast.success(`${selectedIds.length} facture(s) supprimée(s)`)
      setSelectedIds([])
      loadInvoices()
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const exportSelected = () => {
    const selectedInvoices = invoices.filter((inv) => selectedIds.includes(inv.id))
    if (selectedInvoices.length === 0) return
    const headers = ['N° facture', 'Client', 'Date', 'Statut', 'Total HT', 'Total TTC']
    const rows = selectedInvoices.map((inv) => [
      inv.invoiceNumber,
      inv.clientName || 'Client de passage',
      new Date(inv.createdAt).toLocaleDateString('fr-FR'),
      STATUS_LABELS[inv.status] || inv.status,
      (inv.subtotal / 100).toFixed(2),
      (inv.total / 100).toFixed(2),
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `factures_selection_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteInvoice(deleteTarget.id)
      toast.success(`Facture ${deleteTarget.invoiceNumber} supprimée`)
      setDeleteTarget(null)
      loadInvoices()
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const exportAllCSV = () => {
    const headers = ['N° facture', 'Client', 'Date', 'Statut', 'Total HT', 'Total TTC']
    const rows = filteredData.map((inv) => [
      inv.invoiceNumber,
      inv.clientName || 'Client de passage',
      new Date(inv.createdAt).toLocaleDateString('fr-FR'),
      STATUS_LABELS[inv.status] || inv.status,
      (inv.subtotal / 100).toFixed(2),
      (inv.total / 100).toFixed(2),
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `factures_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const isWalkInClient = (clientName: string | null, clientId: string | null): boolean => {
    if (clientId === 'client_walkin') return true
    if (clientName) {
      const lower = clientName.toLowerCase()
      return lower.includes('passage') || lower.includes('عابر')
    }
    return false
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <Home className="h-3.5 w-3.5" />
          <span>{t('common.home', 'Accueil')}</span>
        </span>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span>{t('common.sales', 'Ventes')}</span>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-900 dark:text-white">{t('invoices.title', 'Factures')}</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('invoices.title', 'Factures')}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t('invoices.search', 'Rechercher...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-10"
            />
          </div>

          {/* Filtre par date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-9 rounded-xl bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-10 w-48"
            />
          </div>

          {dateFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDateFilter('')}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕ Effacer
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">{totalItems}</span>
          {selectedIds.length > 0 && (
            <>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl h-9 border-red-200 text-red-600 hover:bg-red-50" onClick={handleDeleteSelected}>
                <Trash2 className="h-4 w-4" /> Supprimer ({selectedIds.length})
              </Button>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl h-9 border-gray-200" onClick={exportSelected}>
                <Download className="h-4 w-4" /> Exporter sélection
              </Button>
            </>
          )}
          <Button variant="outline" className="gap-2 rounded-xl h-10 border-gray-200" onClick={exportAllCSV}>
            <Download className="h-4 w-4" /> {t('invoices.export', 'Exporter')}
          </Button>
          <Button className="gap-2 rounded-xl h-10 text-white" style={{ backgroundColor: DARK_BLUE }} onClick={() => router.push('/dashboard/caisse')}>
            <Plus className="h-4 w-4" /> {t('invoices.new', 'Nouvelle facture')}
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : paginatedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">{t('invoices.no_data', 'Aucune facture')}</p>
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
                    const statusLabel = STATUS_LABELS[inv.status] || inv.status
                    const isWalkin = isWalkInClient(inv.clientName, inv.clientId)
                    const clientDisplay = isWalkin
                      ? t('pos.walkin_client', 'Client de passage')
                      : inv.clientName || t('invoices.anonymous', 'Anonyme')
                    return (
                      <TableRow key={inv.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                        <TableCell><Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(inv.id)} /></TableCell>
                        <TableCell className="font-mono text-sm font-bold" style={{ color: DARK_BLUE }}>{inv.invoiceNumber}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
                              {clientDisplay.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm">{clientDisplay}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{new Date(inv.createdAt).toLocaleDateString('fr-FR')}</TableCell>
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
                              <DropdownMenuItem onClick={() => handleView(inv)} className="gap-2"><Eye className="h-4 w-4" /> {t('common.view', 'Voir')}</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(inv.id)} className="gap-2"><Pencil className="h-4 w-4" /> {t('common.edit', 'Modifier')}</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDeleteTarget(inv)} className="gap-2 text-red-500"><Trash2 className="h-4 w-4" /> {t('common.delete', 'Supprimer')}</DropdownMenuItem>
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

      {/* Modale visualisation */}
      <Dialog open={!!viewingInvoice} onOpenChange={(open) => !open && setViewingInvoice(null)}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Facture {viewingInvoice?.invoiceNumber}</DialogTitle>
            <DialogDescription>Détails de la facture sélectionnée.</DialogDescription>
          </DialogHeader>
          {viewingInvoice && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Client</p>
                  <p className="font-medium">
                    {isWalkInClient(viewingInvoice.clientName, viewingInvoice.clientId)
                      ? t('pos.walkin_client', 'Client de passage')
                      : viewingInvoice.clientName || t('invoices.anonymous', 'Anonyme')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{new Date(viewingInvoice.createdAt).toLocaleDateString('fr-FR')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Statut</p>
                  <Badge style={{ backgroundColor: STATUS_COLORS[viewingInvoice.status] || '#6B7280', color: '#ffffff' }} className="border-0">
                    {STATUS_LABELS[viewingInvoice.status] || viewingInvoice.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total TTC</p>
                  <p className="text-xl font-bold" style={{ color: GOLD }}>{formatMAD(viewingInvoice.total)}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setViewingInvoice(null)}>Fermer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>Êtes-vous sûr de vouloir supprimer la facture {deleteTarget?.invoiceNumber} ? Cette action est irréversible.</AlertDialogDescription>
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