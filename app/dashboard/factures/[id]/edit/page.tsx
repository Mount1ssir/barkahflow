'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { ArrowLeft, Save, FileText } from 'lucide-react'
import {
  getInvoiceById,
  getInvoiceLines,
  getAllClients,
  updateInvoice,
  type Invoice,
  type InvoiceLine,
  type Client,
} from '@/lib/invoice-data'
import { formatMAD } from '@/lib/stats-data'

const GOLD = '#D4A017'
const DARK_BLUE = '#1D4ED8'
const DARK_NAVY = '#0F172A'
const WALKIN_CLIENT_ID = '' // ✅ valeur vide pour le client de passage

export default function InvoiceEditPage() {
  const { t } = useTranslation()
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [lines, setLines] = useState<InvoiceLine[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clientId, setClientId] = useState<string>(WALKIN_CLIENT_ID)
  const [status, setStatus] = useState<string>('')
  const [date, setDate] = useState<string>('')

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const loadData = async () => {
    try {
      const [invoiceData, linesData, clientsData] = await Promise.all([
        getInvoiceById(id),
        getInvoiceLines(id),
        getAllClients(),
      ])
      if (!invoiceData) {
        toast.error('Facture introuvable')
        router.push('/dashboard/factures')
        return
      }
      setInvoice(invoiceData)
      setLines(linesData)
      setClients(clientsData)
      // ✅ Si client_id est NULL, on utilise la valeur vide (client de passage)
      setClientId(invoiceData.clientId || WALKIN_CLIENT_ID)
      setStatus(invoiceData.status)
      setDate(invoiceData.createdAt.split('T')[0])
    } catch (error) {
      console.error(error)
      toast.error('Erreur chargement facture')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!invoice) return
    setSaving(true)
    try {
      // ✅ Si c'est le client de passage (valeur vide), on envoie NULL
      const finalClientId = clientId === WALKIN_CLIENT_ID ? null : clientId
      await updateInvoice(invoice.id, {
        clientId: finalClientId,
        status,
        date: date + 'T00:00:00.000Z',
      })
      toast.success('Facture mise à jour avec succès')
      router.push('/dashboard/factures')
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Skeleton className="h-12 w-48 mb-4" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-bold">Facture introuvable</h2>
        <Button onClick={() => router.push('/dashboard/factures')} className="mt-4">
          Retour aux factures
        </Button>
      </div>
    )
  }

  const statusOptions = [
    { value: 'PAID', label: 'Payée' },
    { value: 'PARTIAL', label: 'Partielle' },
    { value: 'UNPAID', label: 'Impayée' },
    { value: 'CONFIRMED', label: 'Confirmée' },
    { value: 'DRAFT', label: 'Brouillon' },
    { value: 'CANCELLED', label: 'Annulée' },
  ]

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/dashboard/factures')} className="gap-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Modifier la facture</h1>
          <span className="font-mono text-sm font-bold px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800" style={{ color: DARK_BLUE }}>
            {invoice.invoiceNumber}
          </span>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 rounded-xl text-white px-6"
          style={{ backgroundColor: DARK_NAVY }}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="rounded-xl h-11 border-gray-200 dark:border-gray-700">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {/* ✅ Client de passage avec valeur vide */}
                  <SelectItem value={WALKIN_CLIENT_ID}>
                    {t('pos.walkin_client', 'Client de passage')}
                  </SelectItem>
                  {clients
                    .filter((client) => client.id !== 'client_walkin')
                    .map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.full_name}
                        {client.phone ? ` — ${client.phone}` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Statut</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="rounded-xl h-11 border-gray-200 dark:border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl h-11 border-gray-200 dark:border-gray-700"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Résumé financier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Sous-total</span>
              <span className="font-medium">{formatMAD(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">TVA</span>
              <span className="font-medium">{formatMAD(invoice.tax)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Remise</span>
              <span className="font-medium">{formatMAD(invoice.discount)}</span>
            </div>
            <div className="flex justify-between py-2 text-lg font-bold">
              <span>Total TTC</span>
              <span style={{ color: GOLD }}>{formatMAD(invoice.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border shadow-sm mt-6">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Lignes de facture ({lines.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Aucune ligne pour cette facture</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 font-medium">Produit</th>
                    <th className="pb-2 font-medium text-right">Qté</th>
                    <th className="pb-2 font-medium text-right">Prix unitaire</th>
                    <th className="pb-2 font-medium text-right">Remise</th>
                    <th className="pb-2 font-medium text-right">Sous-total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <td className="py-2 font-medium">{line.productName || 'Produit'}</td>
                      <td className="py-2 text-right">{line.qty}</td>
                      <td className="py-2 text-right">{formatMAD(line.unitPrice)}</td>
                      <td className="py-2 text-right">{line.discount}%</td>
                      <td className="py-2 text-right font-medium">{formatMAD(line.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 dark:border-gray-700">
                  <tr>
                    <td colSpan={4} className="py-3 text-right font-bold">Total</td>
                    <td className="py-3 text-right font-bold" style={{ color: GOLD }}>
                      {formatMAD(invoice.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}