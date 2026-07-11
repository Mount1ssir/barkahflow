'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUserContext } from '@/context/UserContext'
import { PERMISSIONS } from '@/lib/rbac'
import { Guard } from '@/components/rbac/Guard'
import {
  Plus,
  Search,
  Package,
  Box,
  AlertTriangle,
  XCircle,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  MoreHorizontal,
  History,
  RefreshCw,
  Scan,
  Filter,
  LayoutGrid,
  List,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

// ─── Couleurs ──────────────────────────────────────────────────────
const GOLD = '#D4A017'
const PRIMARY = '#2C3E50'

// ─── Composant KPI ────────────────────────────────────────────────
interface KpiCardProps {
  icon: React.ReactNode
  value: number
  label: string
  subtitle: string
  color: string
  bg: string
  progress?: number
  index: number
}

function KpiCard({ icon, value, label, subtitle, color, bg, progress, index }: KpiCardProps) {
  const [isVisible, setIsVisible] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const delay = 100 + index * 100
    const timer = setTimeout(() => setIsVisible(true), delay)
    return () => clearTimeout(timer)
  }, [index])

  return (
    <div
      ref={cardRef}
      className={`rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex-1 min-w-[140px] transition-all duration-500 ease-out hover:shadow-lg hover:-translate-y-1 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-110"
          style={{ backgroundColor: bg }}
        >
          {icon}
        </div>
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
      </div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">{label}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: isVisible ? `${Math.min(progress, 100)}%` : '0%',
              backgroundColor: color,
            }}
          />
        </div>
      )}
    </div>
  )
}

function KpiCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex-1 min-w-[140px]">
      <div className="animate-pulse space-y-3">
        <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  )
}

function getProductStatus(product: Product): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (!product.isActive) return 'in_stock'
  if (product.stockQty <= 0) return 'out_of_stock'
  if (product.stockQty <= product.alertThreshold) return 'low_stock'
  return 'in_stock'
}

const statusConfig = {
  in_stock: { label: 'En stock', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  low_stock: { label: 'Stock bas', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  out_of_stock: { label: 'Rupture', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
}

function ProductImage3D({ src, alt }: { src: string; alt: string }) {
  const [style, setStyle] = useState({
    transform: 'perspective(400px) rotateX(0deg) rotateY(0deg) scale(1)',
  })
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
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

function ProduitsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { can } = useUserContext()

  // ─── Vérification des permissions Produits ──────────────────────
  const canView = can(PERMISSIONS.PRODUCTS_VIEW)
  const canAdd = can(PERMISSIONS.PRODUCTS_ADD)
  const canEdit = can(PERMISSIONS.PRODUCTS_EDIT)
  const canDelete = can(PERMISSIONS.PRODUCTS_DELETE)
  const canRestock = can(PERMISSIONS.PRODUCTS_RESTOCK)
  const canDeactivate = can(PERMISSIONS.PRODUCTS_DEACTIVATE)
  const canHistory = can(PERMISSIONS.PRODUCTS_HISTORY)

  // ─── Si l'utilisateur n'a ni "Voir" ni "Ajouter" ────────────────
  // On affiche un message d'accès limité
  if (!canView && !canAdd) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-7xl mx-auto">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
          <Package className="w-8 h-8 text-gray-300 dark:text-zinc-600" />
        </div>
        <p className="font-semibold text-gray-700 dark:text-gray-300">
          Accès limité aux produits
        </p>
        <p className="text-sm text-gray-400 mt-1 max-w-md">
          Vous n'avez pas les permissions nécessaires pour accéder aux produits.
        </p>
      </div>
    )
  }

  // ─── Reste du code ──────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'stock_bas'>('all')
  const [productIdFilter, setProductIdFilter] = useState<string | null>(null)
  const [productNameFilter, setProductNameFilter] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [replenishProduct, setReplenishProduct] = useState<Product | null>(null)
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)
  const [stats, setStats] = useState<{
    total: number
    inStock: number
    lowStock: number
    outOfStock: number
  }>({ total: 0, inStock: 0, lowStock: 0, outOfStock: 0 })

  const computeStats = useCallback((products: Product[]) => {
    let total = 0, inStock = 0, lowStock = 0, outOfStock = 0
    for (const p of products) {
      if (!p.isActive) continue
      total++
      if (p.stockQty <= 0) outOfStock++
      else if (p.stockQty <= p.alertThreshold) lowStock++
      else inStock++
    }
    return { total, inStock, lowStock, outOfStock }
  }, [])

  // ── Recherche vocale ──
  useEffect(() => {
    const handleSearch = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (typeof detail === 'string') {
        setQuery(detail)
      }
    }
    window.addEventListener('barkahflow:search', handleSearch)
    return () => window.removeEventListener('barkahflow:search', handleSearch)
  }, [])

  // ── Effacer la recherche ──
  useEffect(() => {
    const handleClearSearch = () => {
      setQuery('')
    }
    window.addEventListener('barkahflow:clear-search', handleClearSearch)
    return () => window.removeEventListener('barkahflow:clear-search', handleClearSearch)
  }, [])

  // ── Ouvrir le scanner ──
  useEffect(() => {
    const handleOpenScanner = () => {
      setScannerOpen(true)
    }
    window.addEventListener('barkahflow:open-scanner', handleOpenScanner)
    return () => window.removeEventListener('barkahflow:open-scanner', handleOpenScanner)
  }, [])

  // ── Export ──
  useEffect(() => {
    const handleExport = () => {
      toast.info('Export des produits en cours...')
    }
    window.addEventListener('barkahflow:export', handleExport)
    return () => window.removeEventListener('barkahflow:export', handleExport)
  }, [])

  // ── Rafraîchissement ──
  useEffect(() => {
    const handleRefresh = () => {
      loadProducts()
    }
    window.addEventListener('barkahflow:refresh-list', handleRefresh)
    return () => window.removeEventListener('barkahflow:refresh-list', handleRefresh)
  }, [])

  // ── Historique ──
  useEffect(() => {
    const handleHistory = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (typeof detail === 'string') {
        const product = products.find(p => p.id === detail)
        if (product) {
          setHistoryProduct(product)
        } else {
          toast.error('Produit introuvable')
        }
      }
    }
    window.addEventListener('barkahflow:history', handleHistory)
    return () => window.removeEventListener('barkahflow:history', handleHistory)
  }, [products])

  // ── Filtre stock depuis URL ──
  useEffect(() => {
    const filter = searchParams.get('filter')
    if (filter === 'stock_bas') {
      setStockFilter('stock_bas')
    } else {
      setStockFilter('all')
    }
  }, [searchParams])

  // ── Filtre produit unique ──
  useEffect(() => {
    const produit = searchParams.get('produit')
    setProductIdFilter(produit)
    if (!produit) setProductNameFilter(null)
  }, [searchParams])

  useEffect(() => {
    if (productIdFilter && products.length > 0) {
      const found = products.find((p) => p.id === productIdFilter)
      if (found) setProductNameFilter(found.nameAr)
    }
  }, [productIdFilter, products])

  const clearProductFilter = () => {
    setProductIdFilter(null)
    setProductNameFilter(null)
    router.replace('/dashboard/produits')
  }

  // ── Réapprovisionnement ──
  useEffect(() => {
    const replenish = searchParams.get('replenish')
    if (replenish) {
      const found = products.find(p => p.id === replenish)
      if (found) {
        setReplenishProduct(found)
        router.replace('/dashboard/produits')
      } else {
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

  const loadProducts = useCallback(async () => {
    try {
      let data = query ? await searchProducts(query) : await getAllProducts()
      if (!showInactive) { data = data.filter(p => p.isActive) }

      if (productIdFilter) {
        const single = data.filter((p) => p.id === productIdFilter)
        setProducts(single)
        setStats(computeStats(single))
        setLoading(false)
        return
      }

      if (categoryFilter !== 'all') {
        data = data.filter((p) => p.categoryId === categoryFilter)
      }
      if (statusFilter !== 'all') {
        data = data.filter((p) => {
          const status = getProductStatus(p)
          if (statusFilter === 'in_stock') return status === 'in_stock'
          if (statusFilter === 'low_stock') return status === 'low_stock'
          if (statusFilter === 'out_of_stock') return status === 'out_of_stock'
          return true
        })
      }
      if (stockFilter === 'stock_bas') {
        data = data.filter((p) => p.stockQty <= p.alertThreshold)
      }
      setProducts(data)
      setStats(computeStats(data))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [query, categoryFilter, statusFilter, stockFilter, productIdFilter, showInactive, computeStats])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    getAllCategories().then(setCategories)
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    const targetId = deleteTarget.id
    const targetName = deleteTarget.nameAr
    try {
      await deleteProduct(targetId)
      toast.success(`Produit "${targetName}" supprimé avec succès`)
      setDeleteTarget(null)
      loadProducts()
    } catch (error: any) {
      setDeleteTarget(null)
      toast.error(
        error?.message || 'Ce produit ne peut pas être supprimé',
        {
          description: 'Vous pouvez le désactiver à la place.',
          action: {
            label: 'Désactiver',
            onClick: async () => {
              try {
                await toggleProductStatus(targetId, false)
                toast.success(`Produit "${targetName}" désactivé`)
                loadProducts()
              } catch (toggleError: any) {
                toast.error(toggleError?.message || 'Erreur lors de la désactivation')
              }
            },
          },
        }
      )
    }
  }

  const handleToggle = async (product: Product) => {
    try {
      await toggleProductStatus(product.id, !product.isActive)
      loadProducts()
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors du changement de statut')
    }
  }

  const formatPrice = (centimes: number) => (centimes / 100).toFixed(2)

  const handleAddProduct = () => {
    router.push('/dashboard/produits/nouveau')
  }
  const handleEditProduct = (product: Product) => {
    router.push(`/dashboard/produits/nouveau?id=${product.id}`)
  }

  const handleScan = async (barcode: string) => {
    try {
      const product = await findBySkuOrBarcode(barcode)
      if (product) {
        const name = product.nameFr || product.nameAr
        setQuery(name)
        toast.success(`Produit trouvé : ${name}`)
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

  const renderProducts = () => {
    // Si l'utilisateur n'a pas "Voir", on ne montre pas la liste
    if (!canView) {
      return (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center text-center py-16">
            <div className="h-20 w-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(224,184,111,0.1)' }}>
              <Package className="h-9 w-9" style={{ color: GOLD }} />
            </div>
            <h4 className="text-base font-semibold text-foreground mb-1">
              Accès limité
            </h4>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs">
              Vous n'avez pas la permission de voir les produits.
            </p>
            {canAdd && (
              <Button className="gap-2 rounded-xl text-white font-semibold" style={{ backgroundColor: PRIMARY }} onClick={handleAddProduct}>
                <Plus size={16} /> Ajouter un produit
              </Button>
            )}
          </CardContent>
        </Card>
      )
    }

    if (loading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="rounded-2xl overflow-hidden border shadow-sm animate-pulse">
              <Skeleton className="h-40 w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      )
    }
    if (products.length === 0) {
      return (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center text-center py-16">
            <div className="h-20 w-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(224,184,111,0.1)' }}>
              <Package className="h-9 w-9" style={{ color: GOLD }} />
            </div>
            <h4 className="text-base font-semibold text-foreground mb-1">
              {productIdFilter ? 'Produit introuvable' : 'Aucun produit'}
            </h4>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs">
              {productIdFilter ? 'Ce produit a peut-être été supprimé.' : 'Commencez par ajouter votre premier produit'}
            </p>
            {!productIdFilter && canAdd && (
              <Button className="gap-2 rounded-xl text-white font-semibold" style={{ backgroundColor: PRIMARY }} onClick={handleAddProduct}>
                <Plus size={16} /> Ajouter un produit
              </Button>
            )}
          </CardContent>
        </Card>
      )
    }
    if (viewMode === 'list') {
      return (
        <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <TableHead className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Produit</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">SKU</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Catégorie</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Stock</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Prix (MAD)</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Achat</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Statut</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const status = getProductStatus(product)
                  const statusInfo = statusConfig[status]
                  return (
                    <TableRow key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {product.imagePath ? (
                              <img src={getDisplayUrl(product.imagePath)} alt={product.nameAr} className="w-full h-full object-cover" />
                            ) : (
                              <Package size={18} className="text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{product.nameAr}</p>
                            {product.nameFr && <p className="text-xs text-gray-400 dark:text-gray-500">{product.nameFr}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-500 dark:text-gray-400">{product.sku}</TableCell>
                      <TableCell>
                        {product.categoryName && (
                          <Badge className="border-0 font-medium text-xs px-2.5 py-0.5"
                            style={{ backgroundColor: product.categoryColor ? `${product.categoryColor}20` : '#E5E7EB', color: product.categoryColor || '#6B7280' }}
                          >
                            {product.categoryName}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-gray-900 dark:text-white">{product.stockQty}</TableCell>
                      <TableCell className="text-right font-medium text-gray-900 dark:text-white">{formatPrice(product.retailPrice)}</TableCell>
                      <TableCell className="text-right text-gray-500 dark:text-gray-400">{formatPrice(product.costPrice)}</TableCell>
                      <TableCell>
                        <Badge className="border-0 font-medium text-xs px-3 py-0.5"
                          style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
                        >
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreHorizontal size={16} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl w-48">
                            {canEdit && (
                              <DropdownMenuItem onClick={() => handleEditProduct(product)} className="gap-2">
                                <Edit size={14} /> Modifier
                              </DropdownMenuItem>
                            )}
                            {canRestock && (
                              <DropdownMenuItem onClick={() => setReplenishProduct(product)} className="gap-2">
                                <RefreshCw size={14} /> Réapprovisionner
                              </DropdownMenuItem>
                            )}
                            {canHistory && (
                              <DropdownMenuItem onClick={() => setHistoryProduct(product)} className="gap-2">
                                <History size={14} /> Historique
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {canDeactivate && (
                              <DropdownMenuItem onClick={() => handleToggle(product)} className="gap-2">
                                {product.isActive ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                                {product.isActive ? 'Désactiver' : 'Activer'}
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem onClick={() => setDeleteTarget(product)} className="gap-2 text-red-500 hover:text-red-600">
                                <Trash2 size={14} /> Supprimer
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
              Affichage de 1 à {Math.min(products.length, 10)} sur {products.length} produits
            </div>
          </CardContent>
        </Card>
      )
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.map((product) => {
          return (
            <Card key={product.id} className="rounded-2xl overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
              <div className="h-40 bg-gradient-to-br from-amber-50/50 to-blue-50/50 dark:from-amber-900/10 dark:to-blue-900/10 flex items-center justify-center relative overflow-hidden">
                {product.imagePath ? (
                  <ProductImage3D src={getDisplayUrl(product.imagePath)} alt={product.nameAr} />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #D4A017, #1D4ED8)' }}>
                      <Package className="h-8 w-8 text-white" />
                    </div>
                    <span className="text-xs text-slate-400 dark:text-gray-500 font-medium">Aucune image</span>
                  </div>
                )}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {!product.isActive && <Badge variant="secondary" className="text-[10px]">Inactif</Badge>}
                  {product.isActive && product.stockQty === 0 && <Badge variant="destructive" className="text-[10px]">Rupture</Badge>}
                  {product.isActive && product.stockQty > 0 && product.stockQty <= product.alertThreshold && (
                    <Badge className="text-[10px]" style={{ backgroundColor: '#f59e0b', color: '#ffffff' }}>Stock bas</Badge>
                  )}
                </div>
                <div className="absolute top-2 right-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon" className="h-7 w-7 rounded-lg opacity-80 hover:opacity-100"><Filter size={12} /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl w-48">
                      {canEdit && (
                        <DropdownMenuItem onClick={() => handleEditProduct(product)} className="gap-2">
                          <Edit size={14} /> Modifier
                        </DropdownMenuItem>
                      )}
                      {canRestock && (
                        <DropdownMenuItem onClick={() => setReplenishProduct(product)} className="gap-2">
                          <RefreshCw size={14} /> Réapprovisionner
                        </DropdownMenuItem>
                      )}
                      {canHistory && (
                        <DropdownMenuItem onClick={() => setHistoryProduct(product)} className="gap-2">
                          <History size={14} /> Historique
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {canDeactivate && (
                        <DropdownMenuItem onClick={() => handleToggle(product)} className="gap-2">
                          {product.isActive ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                          {product.isActive ? 'Désactiver' : 'Activer'}
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem onClick={() => setDeleteTarget(product)} className="gap-2 text-destructive">
                          <Trash2 size={14} /> Supprimer
                        </DropdownMenuItem>
                      )}
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
                    <p className="text-base font-bold" style={{ color: GOLD }}>{formatPrice(product.retailPrice)} MAD</p>
                    <p className="text-[10px] text-muted-foreground">Achat : {formatPrice(product.costPrice)} MAD</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{product.stockQty} {product.unit}</p>
                    {product.stockQty <= product.alertThreshold && product.stockQty > 0 && (
                      <div className="flex items-center gap-1">
                        <AlertTriangle size={10} style={{ color: '#f59e0b' }} />
                        <p className="text-[10px]" style={{ color: '#f59e0b' }}>Stock bas</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Produits</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Gérez vos produits, votre inventaire et vos tarifs.</p>
        </div>
        {canAdd && (
          <Button className="gap-2 rounded-xl text-white font-medium shadow-sm hover:shadow-md transition-all" style={{ backgroundColor: PRIMARY }} onClick={handleAddProduct}>
            <Plus size={16} /> Ajouter un produit
          </Button>
        )}
      </div>

      {/* Bandeau filtre produit unique */}
      {productIdFilter && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-blue-500 shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300 flex-1">
            Affichage filtré pour le produit : <strong>{productNameFilter || productIdFilter}</strong>
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearProductFilter}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg h-7 px-2 gap-1"
          >
            <X className="h-3.5 w-3.5" /> Effacer le filtre
          </Button>
        </div>
      )}

      {/* ─── STATS ────────────────────────────────────────────────────── */}
      {/* Les stats sont visibles uniquement si l'utilisateur a "Voir" */}
      {canView && (
        <>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <KpiCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiCard icon={<Package size={20} style={{ color: PRIMARY }} />} value={stats.total} label="Total produits" subtitle="Tous les produits actifs" color={PRIMARY} bg="rgba(44,62,80,0.10)" progress={100} index={0} />
              <KpiCard icon={<Box size={20} style={{ color: '#22C55E' }} />} value={stats.inStock} label="En stock" subtitle={stats.total > 0 ? `${Math.round((stats.inStock / stats.total) * 100)}% du total` : '0% du total'} color="#22C55E" bg="rgba(34,197,94,0.10)" progress={stats.total > 0 ? (stats.inStock / stats.total) * 100 : 0} index={1} />
              <KpiCard icon={<AlertTriangle size={20} style={{ color: '#F59E0B' }} />} value={stats.lowStock} label="Stock bas" subtitle="Nécessite une attention" color="#F59E0B" bg="rgba(245,158,11,0.10)" progress={stats.total > 0 ? (stats.lowStock / stats.total) * 100 : 0} index={2} />
              <KpiCard icon={<XCircle size={20} style={{ color: '#EF4444' }} />} value={stats.outOfStock} label="Rupture" subtitle="Indisponible" color="#EF4444" bg="rgba(239,68,68,0.10)" progress={stats.total > 0 ? (stats.outOfStock / stats.total) * 100 : 0} index={3} />
            </div>
          )}
        </>
      )}

      {/* ─── FILTRES ──────────────────────────────────────────────────── */}
      {/* Les filtres sont visibles uniquement si l'utilisateur a "Voir" */}
      {canView && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Rechercher un produit..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 h-10 text-sm" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 rounded-xl h-10 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"><SelectValue placeholder="Catégorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.nameFr}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 rounded-xl h-10 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="in_stock">En stock</SelectItem>
              <SelectItem value="low_stock">Stock bas</SelectItem>
              <SelectItem value="out_of_stock">Rupture</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setScannerOpen(true)} className="gap-2 rounded-xl border-gray-200 dark:border-gray-700 h-10 text-white hover:bg-blue-800 transition-colors" style={{ backgroundColor: PRIMARY }}>
            <Scan size={15} className="text-white" /> Scanner
          </Button>
          <Button variant={showInactive ? 'default' : 'outline'} size="sm" onClick={() => setShowInactive(!showInactive)}
            className="rounded-xl h-10 px-4 font-medium" style={showInactive ? { backgroundColor: PRIMARY, color: 'white' } : {}}>
            {showInactive ? 'Masquer inactifs' : 'Afficher inactifs'}
          </Button>
          <div className="flex items-center gap-1 ml-auto border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <Button variant="ghost" size="sm" className={`rounded-none h-9 px-3 ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`} onClick={() => setViewMode('list')}>
              <List size={16} className={viewMode === 'list' ? 'text-gray-900 dark:text-white' : 'text-gray-400'} />
            </Button>
            <Button variant="ghost" size="sm" className={`rounded-none h-9 px-3 ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`} onClick={() => setViewMode('grid')}>
              <LayoutGrid size={16} className={viewMode === 'grid' ? 'text-gray-900 dark:text-white' : 'text-gray-400'} />
            </Button>
          </div>
        </div>
      )}

      {/* ─── LISTE DES PRODUITS ────────────────────────────────────── */}
      {renderProducts()}

      {/* ─── DIALOGS ────────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.nameAr} — Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} style={{ backgroundColor: '#EF4444' }}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {replenishProduct && (
        <ReplenishStockDialog open={!!replenishProduct} onOpenChange={() => setReplenishProduct(null)} product={replenishProduct} onSuccess={loadProducts} />
      )}
      {historyProduct && (
        <StockHistoryDialog open={!!historyProduct} onOpenChange={() => setHistoryProduct(null)} product={historyProduct} />
      )}
      <BarcodeScannerModal open={scannerOpen} onOpenChange={setScannerOpen} onScan={handleScan} />
    </div>
  )
}

export default function ProduitsPage() {
  return (
    <Guard permission={PERMISSIONS.PRODUCTS_ACCESS} redirectTo="/dashboard">
      <ProduitsContent />
    </Guard>
  )
}