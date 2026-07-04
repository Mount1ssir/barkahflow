'use client'

import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, Minus, Plus, Trash2, Package } from 'lucide-react'
import { getDisplayUrl } from '@/lib/photo-capture'

interface CartItemUI {
  product: {
    id: string
    nameAr: string
    retailPrice: number
    imagePath?: string | null
  }
  quantity: number
}

interface CartProps {
  items: CartItemUI[]
  onUpdateQuantity: (productId: string, quantity: number) => void
  onRemove: (productId: string) => void
  onClearCart: () => void
  onCheckout: () => void
  subtotal: number
  tax: number
  total: number
}

const BLUE_NAVY = '#1E293B'

export function Cart({
  items,
  onUpdateQuantity,
  onRemove,
  onClearCart,
  onCheckout,
  subtotal,
  tax,
  total,
}: CartProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2.5">
          <ShoppingCart className="h-4 w-4 text-gray-500" />
          {t('pos.cart', 'Panier')}
        </h3>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs font-medium px-2.5 py-0.5">
            {items.length} {items.length > 1 ? 'articles' : 'article'}
          </Badge>
          {items.length > 0 && (
            <button
              className="text-xs font-medium text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 rounded-lg px-3 py-1 transition-colors"
              onClick={onClearCart}
            >
              {t('pos.clear_cart', 'Vider')}
            </button>
          )}
        </div>
      </div>

      {/* Liste articles */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <ShoppingCart className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-400">{t('pos.empty_cart', 'Panier vide')}</p>
            <p className="text-xs text-gray-300 dark:text-gray-500 mt-1">
              {t('pos.empty_cart_desc', 'Ajoutez des produits depuis la grille')}
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.product.id}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
            >
              <div className="w-11 h-11 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-100 dark:border-gray-600">
                {item.product.imagePath ? (
                  <img
                    src={getDisplayUrl(item.product.imagePath)}
                    alt={item.product.nameAr}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <Package className="h-5 w-5 text-gray-300" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">
                  {item.product.nameAr}
                </p>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {(item.product.retailPrice / 100).toFixed(2)} MAD
                </p>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-7 text-center text-sm font-medium">
                  {item.quantity}
                </span>
                <button
                  className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors ml-1"
                  onClick={() => onRemove(item.product.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Totaux + Bouton Continuer en bleu marine avec taille réduite */}
      {items.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('pos.subtotal', 'Sous-total')}</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {(subtotal / 100).toFixed(2)} MAD
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('pos.tax', 'TVA')}</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {(tax / 100).toFixed(2)} MAD
            </span>
          </div>
          <div className="flex justify-between text-base font-bold pt-1">
            <span className="text-gray-900 dark:text-gray-50">{t('pos.total', 'Total')}</span>
            <span className="text-gray-900 dark:text-gray-50 text-lg">
              {(total / 100).toFixed(2)} MAD
            </span>
          </div>
          <Button
            className="w-full rounded-2xl mt-3 text-white font-semibold h-10 shadow-sm hover:shadow-md transition-all"
            style={{ backgroundColor: BLUE_NAVY }}
            onClick={onCheckout}
          >
            {t('pos.continue', 'Continuer')}
          </Button>
        </div>
      )}
    </div>
  )
}