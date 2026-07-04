'use client'

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Package, Search, Plus, Scan } from 'lucide-react'
import { type Product } from '@/lib/products-data'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ProductSelectorProps {
  products: Product[]
  categories: { id: string; name: string; color: string }[]
  onAddToCart: (product: Product) => void
  onScannerOpen?: () => void
  loading?: boolean
}

const BLUE_NAVY = '#1E293B' // Bleu marine

export function ProductSelector({
  products,
  categories,
  onAddToCart,
  onScannerOpen,
  loading,
}: ProductSelectorProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const filteredProducts = useMemo(() => {
    let filtered = products
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.nameAr.toLowerCase().includes(q) ||
          p.nameFr?.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      )
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((p) => p.categoryId === categoryFilter)
    }
    return filtered
  }, [products, searchQuery, categoryFilter])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('pos.search_products', 'Rechercher un produit, code-barres ou référence...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-2xl bg-white border border-gray-200 dark:border-gray-700 h-12 text-sm focus:ring-2 focus:ring-gold"
          />
        </div>
        {onScannerOpen && (
          <Button
            onClick={onScannerOpen}
            className="rounded-2xl h-12 px-5 font-medium text-white flex items-center gap-2 shadow-sm hover:shadow-md transition-all"
            style={{ backgroundColor: BLUE_NAVY }}
          >
            <Scan className="h-5 w-5" />
            {t('pos.scanner', 'Scanner')}
          </Button>
        )}
      </div>

      <div className="mb-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full rounded-2xl bg-white border border-gray-200 dark:border-gray-700 h-10">
            <SelectValue placeholder={t('pos.filter_category', 'Toutes les catégories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('pos.all_categories', 'Toutes les catégories')}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-transparent" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <Package className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">{t('pos.no_products', 'Aucun produit trouvé')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-4">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="group relative rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-gold transition-all duration-150 cursor-pointer overflow-hidden"
                onClick={() => onAddToCart(product)}
              >
                <div className="p-4 flex flex-col items-center text-center">
                  <div className="w-full aspect-square rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-3 overflow-hidden">
                    {product.imagePath ? (
                      <img
                        src={product.imagePath}
                        alt={product.nameAr}
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <Package className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                    )}
                  </div>

                  {product.categoryName && (
                    <span
                      className="text-[10px] font-medium px-2.5 py-0.5 rounded-full mb-1.5"
                      style={{
                        backgroundColor: product.categoryColor ? `${product.categoryColor}15` : '#E5E7EB',
                        color: product.categoryColor ?? '#6B7280',
                      }}
                    >
                      {product.categoryName}
                    </span>
                  )}

                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-50 truncate w-full">
                    {product.nameAr}
                  </p>
                  <p className="text-base font-bold mt-0.5 text-gray-900 dark:text-gray-50">
                    {(product.retailPrice / 100).toFixed(2)} MAD
                  </p>
                  <span className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-0.5 rounded-full">
                    {product.stockQty > 0 ? `✓ ${product.stockQty}` : '✗ 0'} {t('pos.in_stock', 'en stock')}
                  </span>
                </div>

                <button
                  className="absolute bottom-3 right-3 w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 shadow-sm opacity-80 group-hover:opacity-100 group-hover:border-gold group-hover:shadow-md transition-all duration-150"
                  onClick={(e) => { e.stopPropagation(); onAddToCart(product) }}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}