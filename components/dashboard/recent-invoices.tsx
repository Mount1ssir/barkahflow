'use client'

import { useEffect, useState } from 'react'
import { FileText, Filter } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMAD } from '@/lib/stats-data'
import { getAllInvoices, type Invoice } from '@/lib/invoice-data'   // ✅ chemin corrigé
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/config'

// ─── Mapping des statuts ────────────────────────────────────────
const statusColorMap: Record<string, string> = {
  PAID: '#16A34A',
  PARTIAL: '#F59E0B',
  UNPAID: '#DC2626',
  CANCELLED: '#DC2626',
  DRAFT: '#6B7280',
  CONFIRMED: '#2563EB',
}

const statusLabelMap: Record<string, string> = {
  PAID: 'Payée',
  PARTIAL: 'Partielle',
  UNPAID: 'Impayée',
  CANCELLED: 'Annulée',
  DRAFT: 'Brouillon',
  CONFIRMED: 'Confirmée',
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  })
}

const isWalkInClient = (clientId: string | null, clientName: string | null): boolean => {
  if (!clientId || clientId === 'client_walkin' || clientId === 'null' || clientId === '') return true
  if (clientName) {
    const lower = clientName.toLowerCase()
    if (lower.includes('passage') || lower.includes('عابر')) return true
  }
  return false
}

export function RecentInvoices() {
  const { t } = useTranslation()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    try {
      const data = await getAllInvoices()
      const sorted = data.sort((a: Invoice, b: Invoice) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setInvoices(sorted)
    } catch (error: any) {
      if (error?.message?.includes('no such table')) {
        console.warn('La table invoices n\'existe pas encore.')
      } else {
        console.error('Erreur chargement factures:', error)
      }
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  const filteredInvoices = statusFilter === 'all'
    ? invoices
    : invoices.filter(inv => inv.status === statusFilter)

  const displayedInvoices = filteredInvoices.slice(0, 10)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
          {t('dashboard.invoices.recent_title', 'Dernières factures')}
        </CardTitle>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-8 rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs">
            <Filter className="mr-2 h-3.5 w-3.5 text-gray-400" />
            <SelectValue placeholder={t('invoices.filter_status', 'Statut')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('invoices.all_status', 'Toutes')}</SelectItem>
            <SelectItem value="PAID">{t('invoices.paid', 'Payées')}</SelectItem>
            <SelectItem value="PARTIAL">{t('invoices.partial', 'Partielles')}</SelectItem>
            <SelectItem value="UNPAID">{t('invoices.unpaid', 'Impayées')}</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : displayedInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <FileText size={32} className="text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {statusFilter === 'all'
                ? t('dashboard.invoices.no_invoices', 'Aucune facture pour le moment')
                : t('dashboard.invoices.no_match', 'Aucune facture avec ce statut')}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('dashboard.invoices.table.invoice', 'Facture')}</TableHead>
                <TableHead>{t('dashboard.invoices.table.client', 'Client')}</TableHead>
                <TableHead>{t('dashboard.invoices.table.date', 'Date')}</TableHead>
                <TableHead>{t('dashboard.invoices.table.status', 'Statut')}</TableHead>
                <TableHead className="text-right">{t('dashboard.invoices.table.amount', 'Montant')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedInvoices.map((invoice) => {
                const isWalkin = isWalkInClient(invoice.clientId, invoice.clientName)
                const clientDisplay = isWalkin
                  ? t('pos.walkin_client', 'Client de passage')
                  : invoice.clientName || t('invoices.anonymous', 'Anonyme')

                const color = statusColorMap[invoice.status] || '#6B7280'
                const label = statusLabelMap[invoice.status] || invoice.status

                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {clientDisplay}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(invoice.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        style={{
                          backgroundColor: color,
                          color: '#ffffff',
                          fontWeight: 600,
                        }}
                        className="border-0"
                      >
                        {label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMAD(invoice.total)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}