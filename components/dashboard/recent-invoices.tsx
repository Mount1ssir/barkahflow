'use client'

import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMAD } from '@/lib/stats-data'
import { getRecentInvoices, type RecentInvoice } from '@/lib/recent-invoices-data'

import { useTranslation } from 'react-i18next'
import '@/lib/i18n/config'

const statusMap = {
  PAID: 'paid',
  PARTIAL: 'partial',
  UNPAID: 'unpaid',
}

const variantMap = {
  PAID: 'default' as const,
  PARTIAL: 'secondary' as const,
  UNPAID: 'destructive' as const,
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  })
}

export function RecentInvoices() {
  const { t, i18n } = useTranslation()

  const [invoices, setInvoices] = useState<RecentInvoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    try {
      const data = await getRecentInvoices(5)
      setInvoices(data)
    } catch (error) {
      console.error('Erreur chargement factures:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card key={i18n.language}>
      <CardHeader>
        <CardTitle className="text-base">
          {t('dashboard.invoices.recent_title', 'Dernières factures')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <FileText size={32} className="text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {t('dashboard.invoices.no_invoices', 'Aucune facture pour le moment')}
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
              {invoices.map((invoice) => {
                const statusKey = statusMap[invoice.status as keyof typeof statusMap] || 'unpaid'
                const label = t(`dashboard.invoices.${statusKey}`, 'En attente')
                const variant = variantMap[invoice.status as keyof typeof variantMap] || 'secondary'
                return (
                  <TableRow key={invoice.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {invoice.clientName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(invoice.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={variant}>
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