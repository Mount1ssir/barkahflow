'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, Package, TrendingUp, TrendingDown, History } from 'lucide-react'
import { getStockHistory, type StockMovement } from '@/lib/stock-data'
import { getProductById, type Product } from '@/lib/products-data'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface StockHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
}

const GOLD = '#D4A017'
const PRIMARY = '#1D4ED8'

export function StockHistoryDialog({
  open,
  onOpenChange,
  product,
}: StockHistoryDialogProps) {
  const { t } = useTranslation()
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [currentStock, setCurrentStock] = useState(0)
  const [totalIn, setTotalIn] = useState(0)
  const [totalOut, setTotalOut] = useState(0)

  useEffect(() => {
    if (!open || !product) return

    const loadHistory = async () => {
      setLoading(true)
      try {
        const data = await getStockHistory(product.id)
        setMovements(data)

        // Calculer les totaux
        let inSum = 0,
          outSum = 0
        data.forEach((m) => {
          if (m.type === 'in') inSum += m.quantity
          else outSum += m.quantity
        })
        setTotalIn(inSum)
        setTotalOut(outSum)

        // Récupérer le stock actuel du produit
        const prod = await getProductById(product.id)
        setCurrentStock(prod ? prod.stockQty : 0)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [open, product])

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy HH:mm', { locale: fr })
    } catch {
      return dateStr
    }
  }

  const formatPrice = (price: number | null) => {
    if (price === null) return '—'
    return (price / 100).toFixed(2) + ' MAD'
  }

  const formatType = (type: 'in' | 'out') => {
    if (type === 'in') return t('stock.type.in')
    return t('stock.type.out')
  }

  const getTypeBadge = (type: 'in' | 'out') => {
    if (type === 'in') {
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">+ {t('stock.type.in')}</Badge>
    }
    return <Badge variant="destructive">- {t('stock.type.out')}</Badge>
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl bg-white dark:bg-gray-900 p-6 max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-extrabold text-gray-900 dark:text-gray-50 flex items-center justify-between">
            <span className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #D4A017, #B8860B)' }}
              >
                <History className="h-5 w-5 text-white" />
              </div>
              {t('stock.history.title')}
              {product && (
                <span className="text-base font-bold text-slate-500 dark:text-gray-400">
                  {product.nameAr} {product.sku && `(${product.sku})`}
                </span>
              )}
            </span>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full">
              <X className="h-5 w-5" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Résumé */}
        {product && !loading && (
          <div className="grid grid-cols-3 gap-3 mt-2">
            <Card className="rounded-xl border border-slate-200 dark:border-gray-700">
              <CardContent className="p-3 flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-gray-400">{t('stock.history.current_stock')}</p>
                  <p className="text-lg font-extrabold text-gray-900 dark:text-gray-50">{currentStock}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl border border-green-200 dark:border-green-800/30">
              <CardContent className="p-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-gray-400">{t('stock.history.total_in')}</p>
                  <p className="text-lg font-extrabold text-green-600 dark:text-green-400">+{totalIn}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl border border-red-200 dark:border-red-800/30">
              <CardContent className="p-3 flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-gray-400">{t('stock.history.total_out')}</p>
                  <p className="text-lg font-extrabold text-red-600 dark:text-red-400">-{totalOut}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tableau des mouvements */}
        <div className="flex-1 min-h-0 mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
              <span className="ml-2 text-sm text-slate-500">{t('stock.history.loading')}</span>
            </div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Package className="h-12 w-12 text-slate-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-slate-500 dark:text-gray-400">{t('stock.history.no_movements')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px] rounded-xl border border-slate-200 dark:border-gray-700">
              <Table>
                <TableHeader className="sticky top-0 bg-white dark:bg-gray-900 z-10">
                  <TableRow>
                    <TableHead className="font-extrabold text-slate-600 dark:text-gray-300">{t('stock.history.date')}</TableHead>
                    <TableHead className="font-extrabold text-slate-600 dark:text-gray-300">{t('stock.history.type')}</TableHead>
                    <TableHead className="font-extrabold text-slate-600 dark:text-gray-300 text-right">{t('stock.history.quantity')}</TableHead>
                    <TableHead className="font-extrabold text-slate-600 dark:text-gray-300 text-right">{t('stock.history.unit_price')}</TableHead>
                    <TableHead className="font-extrabold text-slate-600 dark:text-gray-300">{t('stock.history.reason')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="text-xs font-mono text-slate-600 dark:text-gray-300">
                        {formatDate(movement.createdAt)}
                      </TableCell>
                      <TableCell>{getTypeBadge(movement.type)}</TableCell>
                      <TableCell className="text-right font-bold">
                        <span className={movement.type === 'in' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {movement.type === 'in' ? '+' : '-'}{movement.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {formatPrice(movement.unitPrice)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-gray-300">
                        {movement.reason || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>

        {/* Pied de dialogue */}
        <div className="flex justify-end mt-4 pt-3 border-t border-slate-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-slate-200 dark:border-gray-700"
          >
            {t('common.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}