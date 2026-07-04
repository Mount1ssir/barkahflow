'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
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
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { ArrowLeft, CreditCard, Wallet, Phone, Mail, MapPin, DollarSign } from 'lucide-react'
import { getClientById, type Client } from '@/lib/client-data'
import { getActiveDebtsByClient, type DebtWithInvoice } from '@/lib/debt-ledger'
import { formatMAD } from '@/lib/stats-data'
import { DebtPaymentDialog } from '@/components/clients/DebtPaymentDialog'

const PRIMARY = '#2C3E50'

export default function ClientDetailPage() {
  const { t } = useTranslation()
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [debts, setDebts] = useState<DebtWithInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDebt, setSelectedDebt] = useState<DebtWithInvoice | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const loadData = async () => {
    try {
      const [clientData, debtsData] = await Promise.all([
        getClientById(id),
        getActiveDebtsByClient(id),
      ])
      if (!clientData) {
        toast.error('Client introuvable')
        router.push('/dashboard/clients')
        return
      }
      setClient(clientData)
      setDebts(debtsData)
    } catch (error) {
      console.error(error)
      toast.error('Erreur chargement du client')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSuccess = () => {
    loadData()
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (!client) return null

  const totalDebt = debts.reduce((sum, d) => sum + d.remainingDebt, 0)

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.push('/dashboard/clients')} className="gap-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Détails du client</h1>
      </div>

      <Card className="rounded-2xl border shadow-sm mb-6">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-gray-500" />
            Informations
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Nom</p>
            <p className="font-medium text-lg">{client.fullName}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Dette totale</p>
            <p className={`font-bold text-xl ${totalDebt > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {formatMAD(totalDebt)}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-500 flex items-center gap-1"><Phone className="h-4 w-4" /> Téléphone</p>
            <p className="font-medium">{client.phone || '—'}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-500 flex items-center gap-1"><Mail className="h-4 w-4" /> Email</p>
            <p className="font-medium">{client.email || '—'}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin className="h-4 w-4" /> Adresse</p>
            <p className="font-medium">{client.address || '—'}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Total dépensé</p>
            <p className="font-medium">{formatMAD(client.totalSpent || 0)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Nombre de factures</p>
            <p className="font-medium">{client.invoiceCount}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-gray-500" />
            Dettes en cours
          </CardTitle>
          <span className="text-sm text-gray-500">{debts.length} dette(s)</span>
        </CardHeader>
        <CardContent>
          {debts.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Aucune dette active</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facture</TableHead>
                  <TableHead>Montant total</TableHead>
                  <TableHead>Solde restant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.map((debt) => (
                  <TableRow key={debt.debtId}>
                    <TableCell className="font-mono">{debt.invoiceNumber}</TableCell>
                    <TableCell>{formatMAD(debt.totalDebt)}</TableCell>
                    <TableCell className="font-bold text-red-500">{formatMAD(debt.remainingDebt)}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          debt.status === 'ACTIVE'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}
                      >
                        {debt.status === 'ACTIVE' ? 'Impayée' : 'Partielle'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedDebt(debt)
                          setDialogOpen(true)
                        }}
                        className="gap-2 rounded-xl"
                        style={{ backgroundColor: PRIMARY }}
                      >
                        <DollarSign className="h-4 w-4" />
                        Encaisser
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DebtPaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        debt={selectedDebt}
        clientName={client.fullName}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  )
}