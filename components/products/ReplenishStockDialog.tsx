'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Package, Plus, Minus } from 'lucide-react'
import { addStock } from '@/lib/stock-data'
import { type Product } from '@/lib/products-data'
import { getDisplayUrl } from '@/lib/photo-capture'

interface ReplenishStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSuccess: () => void
}

const GOLD = '#D4A017'
const PRIMARY = '#1D4ED8'

export function ReplenishStockDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: ReplenishStockDialogProps) {
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setQuantity('')
      setReason('')
    }
  }, [open])

  const handleSubmit = async () => {
    const qty = parseInt(quantity)
    if (!qty || qty <= 0) {
      toast.error('Veuillez saisir une quantité valide')
      return
    }

    if (!product) {
      toast.error('Aucun produit sélectionné')
      return
    }

    setLoading(true)
    try {
      await addStock(
        product.id,
        qty,
        reason.trim() || 'Réapprovisionnement',
        product.costPrice
      )
      toast.success(`${qty} unités ajoutées au stock de ${product.nameAr}`)
      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      console.error(error)
      toast.error(error?.message || 'Erreur lors du réapprovisionnement')
    } finally {
      setLoading(false)
    }
  }

  const incrementQuantity = () => {
    const current = parseInt(quantity) || 0
    setQuantity((current + 1).toString())
  }

  const decrementQuantity = () => {
    const current = parseInt(quantity) || 0
    if (current > 1) {
      setQuantity((current - 1).toString())
    }
  }

  const currentQty = parseInt(quantity) || 0
  const newTotal = product ? product.stockQty + currentQty : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold text-gray-900 dark:text-gray-50 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #D4A017, #B8860B)' }}
            >
              <Package className="h-5 w-5 text-white" />
            </div>
            Réapprovisionner le stock
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Affichage du produit */}
          {product && (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700">
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-gray-700 flex items-center justify-center">
                {product.imagePath ? (
                  <img
                    src={getDisplayUrl(product.imagePath)}
                    alt={product.nameAr}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="h-8 w-8 text-slate-300 dark:text-gray-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-lg text-gray-900 dark:text-gray-50 truncate">
                  {product.nameAr}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {product.sku}
                  </Badge>
                  <span className="text-sm text-slate-500 dark:text-gray-400">
                    {product.nameFr}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm">
                  <span className="text-slate-500 dark:text-gray-400">
                    Stock actuel : <span className="font-bold text-gray-900 dark:text-gray-50">{product.stockQty}</span>
                  </span>
                  <span className="text-slate-500 dark:text-gray-400">
                    Seuil d'alerte : <span className="font-bold">{product.alertThreshold}</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Saisie de la quantité */}
          <div className="space-y-2">
            <Label className="text-sm font-extrabold text-slate-600 dark:text-gray-300">
              Quantité à ajouter <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={decrementQuantity}
                className="rounded-xl h-11 w-11 border-slate-200 dark:border-gray-700"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="rounded-xl border-slate-200 dark:border-gray-700 text-center text-xl font-extrabold h-11"
                placeholder="1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={incrementQuantity}
                className="rounded-xl h-11 w-11 border-slate-200 dark:border-gray-700"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Raison (optionnel) */}
          <div className="space-y-2">
            <Label className="text-sm font-extrabold text-slate-600 dark:text-gray-300">
              Raison <span className="text-xs text-slate-400 font-normal">(optionnel)</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Réapprovisionnement fournisseur"
              rows={2}
              className="rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 resize-none"
            />
          </div>

          {/* Aperçu du total après réapprovisionnement */}
          {currentQty > 0 && product && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
              <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                Total : <span className="text-xl font-extrabold text-blue-900 dark:text-blue-100">{newTotal}</span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-slate-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !quantity || parseInt(quantity) <= 0}
            className="rounded-xl font-extrabold text-white px-6"
            style={{ background: `linear-gradient(135deg, ${PRIMARY}, #1E3A8A)` }}
          >
            {loading ? 'Enregistrement...' : 'Valider'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}