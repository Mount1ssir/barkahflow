'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Search,
  Package,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Filter,
  AlertTriangle,
  History,
  RefreshCw,
  Scan,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getAllProducts,
  searchProducts,
  deleteProduct,
  toggleProductStatus,
  findBySkuOrBarcode,
  type Product,
} from '@/lib/products-data'
import { getAllCategories, type Category } from '@/lib/categories-data'
import { getDisplayUrl } from '@/lib/photo-capture'
import { BarcodeScannerModal } from '@/components/products/BarcodeScannerModal'
import { toast } from 'sonner'
import '@/lib/i18n/config'
import { ReplenishStockDialog } from '@/components/products/ReplenishStockDialog'
import { StockHistoryDialog } from '@/components/products/StockHistoryDialog'

const GOLD = '#D4A017'
const PRIMARY = '#1D4ED8'

// ─── Composant Image 3D ──────────────────────────────────────────
function ProductImage3D({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState({
    transform: 'perspective(400px) rotateX(0deg) rotateY(0deg) scale(1)',
  })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setStyle({
      transform: `perspective(400px) rotateX(${-y * 12}deg) rotateY(${x * 12}deg) scale(1.05)`,
    })
  }

  const handleMouseLeave = () => {
    setStyle({
      transform: 'perspective(400px) rotateX(0deg) rotateY(0deg) scale(1)',
    })
  }

  return (
    <div
      ref={ref}
      className="w-full h-full relative overflow-hidden"
      style={{ transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        style={{
          ...style,
          transition: 'transform 0.1s ease-out',
          transformStyle: 'preserve-3d',
        }}
        className="w-full h-full"
      >
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      </div>
    </div>
  )
}

function ProductCardSkeleton() {
  return (
    <Card className="rounded-2xl overflow-hidden">
      <Skeleton className="h-40 w-full" />
      <CardContent className="p-4">
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-3 w-1/2 mb-3" />
        <Skeleton className="h-4 w-full" />
      </CardContent>
    </Card>
  )
}

export default function ProduitsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'stock_bas'>('all')
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null)
  const [replenishProduct, setReplenishProduct] = useState<Product | null>(null)
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)

  // ─── Détection du paramètre `filter` ──────────────────────────
  useEffect(() => {
    const filter = searchParams.get('filter')
    if (filter === 'stock_bas') {
      setStockFilter('stock_bas')
    } else {
      setStockFilter('all')
    }
  }, [searchParams])

  // ─── Détection du paramètre `replenish` ──────────────────────
  useEffect(() => {
    const replenish = searchParams.get('replenish')
    if (replenish) {
      const found = products.find(p => p.id === replenish)
      if (found) {
        setReplenishProduct(found)
        router.replace('/dashboard/produits')
      } else {
        // Attendre le chargement des produits
        const timer = setTimeout(() => {
          const retry = products.find(p => p.id === replenish)
          if (retry) {
            setReplenishProduct(retry)
            router.replace('/dashboard/produits')
          } else {
            toast.error('Produit introuvable')
            router.replace('/dashboard/produits')
          }
        }, 500)
        return () => clearTimeout(timer)
      }
    }
  }, [searchParams, products, router])

  // ─── Chargement des produits ────────────────────────────────────
  const loadProducts = useCallback(async () => {
    try {
      let data = query ? await searchProducts(query) : await getAllProducts()

      if (categoryFilter !== 'all') {
        data = data.filter((p) => p.categoryId === categoryFilter)
      }

      if (stockFilter === 'stock_bas') {
        data = data.filter((p) => p.stockQty <= p.alertThreshold)
      }

      if (scannedProduct) {
        const scannedInList = data.find((p) => p.id === scannedProduct.id)
        if (scannedInList) {
          data = [scannedInList, ...data.filter((p) => p.id !== scannedProduct.id)]
        } else {
          data = [scannedProduct, ...data]
        }
      }

      setProducts(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [query, categoryFilter, stockFilter, scannedProduct])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    getAllCategories().then(setCategories)
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteProduct(deleteTarget.id)
    setDeleteTarget(null)
    loadProducts()
  }

  const handleToggle = async (product: Product) => {
    await toggleProductStatus(product.id, !product.isActive)
    loadProducts()
  }

  const formatPrice = (centimes: number) => (centimes / 100).toFixed(2) + ' MAD'

  const handleAddProduct = () => {
    router.push('/dashboard/produits/nouveau')
  }

  const handleEditProduct = (product: Product) => {
    router.push(`/dashboard/produits/nouveau?id=${product.id}`)
  }

  // ─── Scan ────────────────────────────────────────────────────────
  const handleScan = async (barcode: string) => {
    try {
      const product = await findBySkuOrBarcode(barcode)
      if (product) {
        setScannedProduct(product)
        setQuery('')
        toast.success(`✅ Produit scanné : ${product.nameAr}`)
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }, 100)
      } else {
        toast.error('Aucun produit trouvé', {
          description: 'Voulez-vous l\'ajouter ?',
          action: {
            label: 'Ajouter',
            onClick: () => {
              router.push(`/dashboard/produits/nouveau?barcode=${encodeURIComponent(barcode)}`)
            },
          },
        })
      }
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors du scan')
    }
  }

  const clearScannedProduct = () => {
    setScannedProduct(null)
    loadProducts()
  }

  const resetStockFilter = () => {
    router.push('/dashboard/produits')
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">
            {t('products.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {products.length} {t('common.total').toLowerCase()}
          </p>
          {stockFilter === 'stock_bas' && (
            <Badge className="ml-2" style={{ backgroundColor: '#ef4444', color: 'white' }}>
              🔔 Alertes stock
            </Badge>
          )}
          {stockFilter === 'stock_bas' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetStockFilter}
              className="ml-1 h-7 px-2"
            >
              <X className="h-4 w-4" /> Réinitialiser
            </Button>
          )}
        </div>
        <Button
          className="gap-2 rounded-xl"
          style={{ backgroundColor: GOLD, color: '#0a1628' }}
          onClick={handleAddProduct}
        >
          <Plus size={16} />
          {t('products.add')}
        </Button>
      </div>

      {/* Filtres + Scan */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('products.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 rounded-xl bg-muted/40 border-none"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48 rounded-xl">
            <SelectValue placeholder={t('products.form.select_category')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('products.all')}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.nameFr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={() => setScannerOpen(true)}
          className="gap-2 rounded-xl border-slate-200 dark:border-gray-700 hover:bg-blue-50 h-11"
        >
          <Scan className="h-4 w-4" style={{ color: PRIMARY }} />
          Scanner
        </Button>
      </div>

      {/* Produit scanné */}
      {scannedProduct && (
        <Card className="rounded-2xl border-2 shadow-lg overflow-hidden" style={{ borderColor: GOLD }}>
          <CardContent className="p-4 flex items-center justify-between bg-gradient-to-r from-amber-50/50 to-blue-50/50 dark:from-amber-900/10 dark:to-blue-900/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-gray-700 flex items-center justify-center">
                {scannedProduct.imagePath ? (
                  <img
                    src={getDisplayUrl(scannedProduct.imagePath)}
                    alt={scannedProduct.nameAr}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="h-6 w-6" style={{ color: GOLD }} />
                )}
              </div>
              <div>
                <p className="font-extrabold text-lg text-gray-900 dark:text-gray-50">
                  {scannedProduct.nameAr}
                </p>
                <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-gray-400">
                  <span>SKU: {scannedProduct.sku}</span>
                  <span>Stock: {scannedProduct.stockQty}</span>
                  <span>{formatPrice(scannedProduct.retailPrice)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="text-xs" style={{ backgroundColor: GOLD, color: 'white' }}>
                Scanné
              </Badge>
              <Button variant="ghost" size="icon" onClick={clearScannedProduct} className="rounded-full">
                <X className="h-4 w-4 text-slate-400" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grille */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center text-center py-16">
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(224,184,111,0.1)' }}
            >
              <Package className="h-9 w-9" style={{ color: GOLD }} />
            </div>
            <h4 className="text-base font-semibold text-foreground mb-1">
              {t('products.no_products')}
            </h4>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs">
              {t('products.no_products_subtitle')}
            </p>
            <Button
              className="gap-2 rounded-xl"
              style={{ backgroundColor: GOLD, color: '#0a1628' }}
              onClick={handleAddProduct}
            >
              <Plus size={16} />
              {t('products.add_first')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => {
            const isScanned = scannedProduct && scannedProduct.id === product.id
            return (
              <Card
                key={product.id}
                className={`rounded-2xl overflow-hidden border shadow-sm hover:shadow-md transition-shadow ${
                  isScanned ? 'border-2' : ''
                }`}
                style={isScanned ? { borderColor: GOLD } : {}}
              >
                <div className="h-40 bg-gradient-to-br from-amber-50/50 to-blue-50/50 dark:from-amber-900/10 dark:to-blue-900/10 flex items-center justify-center relative overflow-hidden">
                  {product.imagePath ? (
                    <ProductImage3D
                      src={getDisplayUrl(product.imagePath)}
                      alt={product.nameAr}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                        style={{
                          background: 'linear-gradient(135deg, #D4A017, #1D4ED8)',
                        }}
                      >
                        <Package className="h-8 w-8 text-white" />
                      </div>
                      <span className="text-xs text-slate-400 dark:text-gray-500 font-medium">
                        Aucune image
                      </span>
                    </div>
                  )}

                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {!product.isActive && (
                      <Badge variant="secondary" className="text-[10px]">
                        {t('common.inactive')}
                      </Badge>
                    )}
                    {product.isActive && product.stockQty === 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {t('products.out_of_stock')}
                      </Badge>
                    )}
                    {product.isActive && product.stockQty > 0 && product.stockQty <= product.alertThreshold && (
                      <Badge className="text-[10px]" style={{ backgroundColor: '#f59e0b', color: '#ffffff' }}>
                        {t('products.low_stock')}
                      </Badge>
                    )}
                    {isScanned && (
                      <Badge className="text-[10px]" style={{ backgroundColor: GOLD, color: 'white' }}>
                        Scanné
                      </Badge>
                    )}
                  </div>

                  <div className="absolute top-2 right-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="h-7 w-7 rounded-lg opacity-80 hover:opacity-100">
                          <Filter size={12} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl w-48">
                        <DropdownMenuItem
                          onClick={() => handleEditProduct(product)}
                          className="gap-2"
                        >
                          <Edit size={14} /> {t('common.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setReplenishProduct(product)} className="gap-2">
                          <RefreshCw size={14} /> {t('stock.replenish.title')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setHistoryProduct(product)} className="gap-2">
                          <History size={14} /> {t('stock.history.title')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleToggle(product)} className="gap-2">
                          {product.isActive ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                          {product.isActive ? t('common.disabled') : t('common.enabled')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteTarget(product)} className="gap-2 text-destructive">
                          <Trash2 size={14} /> {t('products.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm text-foreground truncate">{product.nameAr}</h3>
                  {product.nameFr && <p className="text-xs text-muted-foreground truncate">{product.nameFr}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground font-mono">{product.sku}</span>
                    {product.categoryName && <Badge variant="secondary" className="text-[10px]">{product.categoryName}</Badge>}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <div>
                      <p className="text-base font-bold" style={{ color: GOLD }}>{formatPrice(product.retailPrice)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {t('products.form.cost_price').split('(')[0]}: {formatPrice(product.costPrice)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">{product.stockQty} {product.unit}</p>
                      {product.stockQty <= product.alertThreshold && product.stockQty > 0 && (
                        <div className="flex items-center gap-1">
                          <AlertTriangle size={10} style={{ color: '#f59e0b' }} />
                          <p className="text-[10px]" style={{ color: '#f59e0b' }}>{t('products.form.low_stock_warning')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialogues */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('products.delete_confirm')}</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.nameAr} — {t('products.delete_warning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} style={{ backgroundColor: '#ef4444' }}>
              {t('products.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {replenishProduct && (
        <ReplenishStockDialog
          open={!!replenishProduct}
          onOpenChange={() => setReplenishProduct(null)}
          product={replenishProduct}
          onSuccess={loadProducts}
        />
      )}

      {historyProduct && (
        <StockHistoryDialog
          open={!!historyProduct}
          onOpenChange={() => setHistoryProduct(null)}
          product={historyProduct}
        />
      )}

      <BarcodeScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
      />
    </div>
  )
}