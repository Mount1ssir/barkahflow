'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, AlertCircle, History } from 'lucide-react'
import { toast } from 'sonner'
import { getStockHistory, type StockMovement } from '@/lib/stock-history'
import { formatMAD } from '@/lib/stats-data'

interface StockHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: {
    id: string
    nameAr: string
  } | null
}

export function StockHistoryDialog({ open, onOpenChange, product }: StockHistoryDialogProps) {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [trackStock, setTrackStock] = useState(true)
  const [productName, setProductName] = useState('')

  useEffect(() => {
    if (!open || !product) return

    const loadHistory = async () => {
      setLoading(true)
      try {
        const result = await getStockHistory(product.id)
        setMovements(result.movements)
        setTrackStock(result.trackStock)
        setProductName(result.productName)
      } catch (error) {
        console.error('Erreur chargement historique:', error)
        toast.error('Erreur lors du chargement de l\'historique')
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [open, product])

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'IN':
        return <Badge className="bg-green-500 border-0 text-white">Entree</Badge>
      case 'OUT':
        return <Badge className="bg-red-500 border-0 text-white">Sortie</Badge>
      case 'ADJUSTMENT':
        return <Badge className="bg-amber-500 border-0 text-white">Ajustement</Badge>
      default:
        return <Badge className="bg-gray-500 border-0 text-white">{type}</Badge>
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-500" />
            Historique du stock - {productName || product?.nameAr}
          </DialogTitle>
          <DialogDescription>
            {trackStock 
              ? 'Consultez tous les mouvements de stock de ce produit.' 
              : 'Le suivi des mouvements de stock est desactive pour ce produit. Aucun historique n\'est disponible.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : !trackStock ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Suivi desactive
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                L'option "Suivre les mouvements de stock" est desactivee pour ce produit.
                Aucun historique n'est enregistre.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Pour activer le suivi, modifiez le produit et activez l'option.
              </p>
            </div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Aucun mouvement
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ce produit n'a pas encore de mouvement de stock.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantite</TableHead>
                  <TableHead>Avant</TableHead>
                  <TableHead>Apres</TableHead>
                  <TableHead>Motif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm">{formatDate(m.createdAt)}</TableCell>
                    <TableCell>{getTypeBadge(m.type)}</TableCell>
                    <TableCell className="font-bold">
                      {m.type === 'IN' ? '+' : '-'}{m.quantity}
                    </TableCell>
                    <TableCell>{m.previousQty}</TableCell>
                    <TableCell>{m.newQty}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {m.reason || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}