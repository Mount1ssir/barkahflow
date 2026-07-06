'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ProductSelector } from '@/components/pos/ProductSelector'
import { Cart } from '@/components/pos/Cart'
import { CheckoutModal } from '@/components/pos/CheckoutModal'
import { BarcodeScannerModal } from '@/components/products/BarcodeScannerModal'
import { getAllProducts, type Product } from '@/lib/products-data'
import { getAllCategories, type Category } from '@/lib/categories-data'
import { useHotkeys } from 'react-hotkeys-hook'
import { useCart } from '@/lib/store/cart-store'

export default function CaissePage() {
  const { t } = useTranslation()
  const router = useRouter()

  // ✅ Le panier vient maintenant du store partagé (accessible aussi depuis l'assistant vocal)
  const { items: cart, addToCart, removeFromCart, updateQuantity, clearCart } = useCart()

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  // ✅ Écoute des événements envoyés par l'assistant vocal
  // (ex : "finalise la commande" -> ouvre le modal de checkout)
  useEffect(() => {
    const handleOpenCheckout = () => setCheckoutOpen(true)
    const handleCloseCheckout = () => setCheckoutOpen(false)

    window.addEventListener('barkahflow:open-checkout', handleOpenCheckout)
    window.addEventListener('barkahflow:close-checkout', handleCloseCheckout)
    return () => {
      window.removeEventListener('barkahflow:open-checkout', handleOpenCheckout)
      window.removeEventListener('barkahflow:close-checkout', handleCloseCheckout)
    }
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [prodData, catData] = await Promise.all([
        getAllProducts(true),
        getAllCategories(),
      ])
      setProducts(prodData)
      setCategories(catData)
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }

  const handleScan = (barcode: string) => {
    const found = products.find((p) => p.barcode === barcode)
    if (found) {
      addToCart(found)
      toast.success(`Ajouté : ${found.nameAr}`)
    } else {
      toast.error('Aucun produit trouvé pour ce code-barres')
    }
  }

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.retailPrice * item.quantity,
    0
  )
  const tax = cart.reduce(
    (sum, item) =>
      sum + (item.product.retailPrice * item.quantity * item.product.taxRate) / 100,
    0
  )
  const total = subtotal + tax

  useHotkeys('ctrl+e, cmd+e', (e: KeyboardEvent) => {
    e.preventDefault()
    if (cart.length > 0) setCheckoutOpen(true)
  })

  const cartItems = cart.map((item) => ({
    product: {
      id: item.product.id,
      nameAr: item.product.nameAr,
      retailPrice: item.product.retailPrice,
      imagePath: item.product.imagePath,
    },
    quantity: item.quantity,
  }))

  return (
    <div className="h-[calc(100vh-7rem)] flex gap-6 max-w-7xl mx-auto w-full">
      <div className="flex-1 min-w-0">
        <div className="h-full flex flex-col">
          <div className="mb-2">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
              {t('pos.title', 'Point de vente')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {t('pos.subtitle', 'Sélectionnez des produits et passez la commande')}
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <ProductSelector
              products={products}
              categories={categories.map((c) => ({ id: c.id, name: c.nameFr, color: c.color || '#6B7280' }))}
              onAddToCart={addToCart}
              onScannerOpen={() => setScannerOpen(true)}
              loading={loading}
            />
          </div>
        </div>
      </div>

      <div className="w-[380px] shrink-0">
        <Cart
          items={cartItems}
          onUpdateQuantity={updateQuantity}
          onRemove={removeFromCart}
          onClearCart={clearCart}
          onCheckout={() => setCheckoutOpen(true)}
          subtotal={subtotal}
          tax={tax}
          total={total}
        />
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
      />

      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        cart={cart}
        total={total}
        subtotal={subtotal}
        tax={tax}
        onSuccess={(invoiceId, invoiceNumber) => {
          clearCart()
          toast.success(`Facture ${invoiceNumber} créée`)
          router.push(`/dashboard/factures/${invoiceId}`)
        }}
      />
    </div>
  )
}