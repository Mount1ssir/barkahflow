'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import {
  Upload,
  RefreshCw,
  X,
  Package,
  CheckCircle2,
  AlertCircle,
  Info,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Save,
  Star,
  Activity,
  Eye,
  RotateCcw,
  ArrowLeft,
  Scan,
  Plus,
  ChevronRight,
  ChevronLeft,
  Search,
  Pencil,
} from 'lucide-react'
import {
  createProduct,
  updateProduct,
  generateNextSku,
  isSkuTaken,
  isBarcodeTaken,
  validateProductInput,
  type ProductInput,
  findBySkuOrBarcode,
  getProductById,
  type Product,
} from '@/lib/products-data'
import {
  getAllCategories,
  seedDefaultCategories,
  type Category,
} from '@/lib/categories-data'
import { uploadProductImage } from '@/lib/photo-upload'
import { AddCategoryDialog } from '@/components/products/AddCategoryDialog'
import { BarcodeScannerModal } from '@/components/products/BarcodeScannerModal'

const UNITS = ['piece', 'kg', 'g', 'l', 'ml', 'box', 'carton'] as const
type Unit = (typeof UNITS)[number]
const TAX_RATES = [0, 7, 10, 14, 20]
const ORANGE = '#F59E0B'
const ORANGE_DARK = '#EA580C'
const PRIMARY = '#1D4ED8'
const ORANGE_SOFT = '#FBBF24'

const STEPS = [
  { id: 1, label: 'Informations', icon: Info },
  { id: 2, label: 'Identifiants', icon: Scan },
  { id: 3, label: 'Prix', icon: DollarSign },
  { id: 4, label: 'Stock', icon: ShoppingCart },
  { id: 5, label: 'Options', icon: Activity },
]

// ─── Upload d'image simplifié ──────────────────────────────────
function SimpleImageUpload({ src, onUpload, onRemove }: {
  src?: string | null
  onUpload: (file: File) => void
  onRemove: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex items-center gap-4">
      {src ? (
        <>
          <div className="w-16 h-16 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0 bg-gray-50 dark:bg-gray-800">
            <img src={src} alt="Aperçu" className="w-full h-full object-cover" />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRemove}
            className="rounded-xl border-red-200 text-red-500 hover:bg-red-50"
          >
            <X className="h-4 w-4 mr-1" /> Supprimer
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl border-gray-300 dark:border-gray-600 h-11 px-4 gap-2"
        >
          <Upload className="h-4 w-4 text-gray-500" />
          Télécharger une image
        </Button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUpload(file)
        }}
      />
    </div>
  )
}

// ─── Composant Principal ──────────────────────────────────────────
export default function NewProductPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const productId = searchParams.get('id')

  const [loading, setLoading] = useState(false)
  const [loadingProduct, setLoadingProduct] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [existingProduct, setExistingProduct] = useState<Product | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const [form, setForm] = useState({
    nameFr: '',
    sku: '',
    barcode: '',
    categoryId: '',
    unit: '' as Unit | '',
    costPrice: '',
    retailPrice: '',
    taxRate: '0',
    stockQty: '',
    alertThreshold: '5',
    supplierRef: '',
    description: '',
    isActive: true,
    showInPos: true,
    trackStock: true,
    isFavorite: false,
    imageFile: null as File | null,
    imagePreview: null as string | null,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [skuCheck, setSkuCheck] = useState<{
    valid: boolean
    message?: string
    checked: boolean
  }>({ valid: true, checked: false })
  const [barcodeCheck, setBarcodeCheck] = useState<{
    valid: boolean
    message?: string
    checked: boolean
  }>({ valid: true, checked: false })

  const handleChange = useCallback((field: keyof typeof form, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: '' }))
  }, [])

  // ─── Générateur de SKU à partir du code-barres ────────────────
  const generateSkuFromBarcode = useCallback(async (barcode: string) => {
    if (!barcode) return
    const clean = barcode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    if (!clean) return

    let baseSku = `SKU-${clean}`
    let exists = await isSkuTaken(baseSku, isEditMode ? productId || undefined : undefined)
    let counter = 1
    let finalSku = baseSku
    while (exists) {
      finalSku = `${baseSku}-${counter}`
      exists = await isSkuTaken(finalSku, isEditMode ? productId || undefined : undefined)
      counter++
    }
    handleChange('sku', finalSku)
    setSkuCheck({ valid: true, checked: true })
    toast.info(`SKU généré : ${finalSku}`)
  }, [isEditMode, productId, handleChange])

  // ─── Effet déclenché lors du scan (ou saisie manuelle) ────────
  useEffect(() => {
    if (form.barcode && form.barcode.trim().length > 0 && !isEditMode) {
      if (!form.sku || form.sku === '' || form.sku.startsWith('PRD-')) {
        generateSkuFromBarcode(form.barcode)
      }
    }
  }, [form.barcode, form.sku, generateSkuFromBarcode, isEditMode])

  const costNum = parseFloat(form.costPrice) || 0
  const retailNum = parseFloat(form.retailPrice) || 0
  const taxNum = parseFloat(form.taxRate) || 0
  const margin = retailNum - costNum
  const marginPercent = costNum > 0 ? (margin / costNum) * 100 : 0
  const totalTTC = retailNum + (retailNum * taxNum) / 100

  const step1Valid =
    form.nameFr.trim().length > 0 &&
    form.categoryId.length > 0 &&
    form.unit.length > 0
  const step2Valid = form.sku.trim().length > 0 && skuCheck.valid
  const step3Valid = retailNum > 0 && (costNum === 0 || margin > 0)
  const isReady = step1Valid && step2Valid && step3Valid

  const isStepComplete = (step: number) => {
    if (step === 1) return step1Valid
    if (step === 2) return step2Valid
    if (step === 3) return step3Valid
    return true
  }
  const canProceed = isStepComplete(currentStep)
  const nextStep = () => {
    if (currentStep < STEPS.length) setCurrentStep((s) => s + 1)
  }
  const prevStep = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1)
  }

  const loadCategories = useCallback(async () => {
    await seedDefaultCategories()
    const cats = await getAllCategories()
    setCategories(cats)
    return cats
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  useEffect(() => {
    if (productId) {
      setIsEditMode(true)
      setLoadingProduct(true)
      getProductById(productId)
        .then((product) => {
          if (product) {
            setExistingProduct(product)
            setForm({
              nameFr: product.nameFr || '',
              sku: product.sku,
              barcode: product.barcode || '',
              categoryId: product.categoryId || '',
              unit: product.unit as Unit,
              costPrice: (product.costPrice / 100).toString(),
              retailPrice: (product.retailPrice / 100).toString(),
              taxRate: product.taxRate.toString(),
              stockQty: product.stockQty.toString(),
              alertThreshold: product.alertThreshold.toString(),
              supplierRef: product.supplierName || '',
              description: product.description || '',
              isActive: product.isActive,
              showInPos: product.showInPos,
              trackStock: product.trackStock,
              isFavorite: product.isFavorite,
              imageFile: null,
              imagePreview: product.imagePath || null,
            })
            setSkuCheck({ valid: true, checked: true })
            setBarcodeCheck({ valid: true, checked: true })
            toast.info(`Mode édition : ${product.nameFr || product.sku}`)
          } else {
            toast.error('Produit non trouvé')
            router.push('/dashboard/produits')
          }
        })
        .catch((err) => {
          console.error(err)
          toast.error('Erreur lors du chargement du produit')
        })
        .finally(() => setLoadingProduct(false))
    } else {
      generateNextSku().then((sku) => {
        setForm((prev) => ({ ...prev, sku }))
        setSkuCheck({ valid: true, checked: true })
      })
    }
  }, [productId, router])

  useEffect(() => {
    if (!form.sku.trim()) {
      setSkuCheck({ valid: true, checked: false })
      return
    }
    const timer = setTimeout(async () => {
      const taken = await isSkuTaken(form.sku, isEditMode ? productId || undefined : undefined)
      setSkuCheck(
        taken
          ? { valid: false, checked: true, message: t('products.duplicate_sku') }
          : { valid: true, checked: true }
      )
    }, 500)
    return () => clearTimeout(timer)
  }, [form.sku, t, isEditMode, productId])

  useEffect(() => {
    if (!form.barcode.trim()) {
      setBarcodeCheck({ valid: true, checked: false })
      return
    }
    const timer = setTimeout(async () => {
      const taken = await isBarcodeTaken(form.barcode, isEditMode ? productId || undefined : undefined)
      setBarcodeCheck(
        taken
          ? { valid: false, checked: true, message: t('products.duplicate_barcode') }
          : { valid: true, checked: true }
      )
    }, 500)
    return () => clearTimeout(timer)
  }, [form.barcode, t, isEditMode, productId])

  const handleGenerateSku = async () => {
    const sku = await generateNextSku()
    handleChange('sku', sku)
    setSkuCheck({ valid: true, checked: true })
    toast.info(t('products.sku_generated'))
  }

  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)

  const handleSearchProduct = async () => {
    if (!searchQuery.trim()) {
      toast.warning('Veuillez saisir un SKU ou un code-barres')
      return
    }
    setSearching(true)
    try {
      const product = await findBySkuOrBarcode(searchQuery.trim())
      if (product) {
        setForm({
          nameFr: product.nameFr || '',
          sku: product.sku,
          barcode: product.barcode || '',
          categoryId: product.categoryId || '',
          unit: product.unit as Unit,
          costPrice: (product.costPrice / 100).toString(),
          retailPrice: (product.retailPrice / 100).toString(),
          taxRate: product.taxRate.toString(),
          stockQty: product.stockQty.toString(),
          alertThreshold: product.alertThreshold.toString(),
          supplierRef: product.supplierName || '',
          description: product.description || '',
          isActive: product.isActive,
          showInPos: product.showInPos,
          trackStock: product.trackStock,
          isFavorite: product.isFavorite,
          imageFile: null,
          imagePreview: product.imagePath || null,
        })
        setSkuCheck({ valid: true, checked: true })
        toast.success('Produit chargé avec succès')
        setCurrentStep(1)
      } else {
        toast.info('Aucun produit trouvé avec ce SKU ou code-barres')
      }
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors de la recherche')
    } finally {
      setSearching(false)
    }
  }

  const handleScan = (barcode: string) => {
    setForm((prev) => ({ ...prev, barcode }))
    setBarcodeCheck({ valid: true, checked: false })
  }

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Le fichier doit être une image')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 5 Mo')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setForm((f) => ({
        ...f,
        imageFile: file,
        imagePreview: reader.result as string,
      }))
    }
    reader.readAsDataURL(file)
  }

  const resetForm = () => {
    if (isEditMode && existingProduct) {
      setForm({
        nameFr: existingProduct.nameFr || '',
        sku: existingProduct.sku,
        barcode: existingProduct.barcode || '',
        categoryId: existingProduct.categoryId || '',
        unit: existingProduct.unit as Unit,
        costPrice: (existingProduct.costPrice / 100).toString(),
        retailPrice: (existingProduct.retailPrice / 100).toString(),
        taxRate: existingProduct.taxRate.toString(),
        stockQty: existingProduct.stockQty.toString(),
        alertThreshold: existingProduct.alertThreshold.toString(),
        supplierRef: existingProduct.supplierName || '',
        description: existingProduct.description || '',
        isActive: existingProduct.isActive,
        showInPos: existingProduct.showInPos,
        trackStock: existingProduct.trackStock,
        isFavorite: existingProduct.isFavorite,
        imageFile: null,
        imagePreview: existingProduct.imagePath || null,
      })
    } else {
      setForm({
        nameFr: '',
        sku: '',
        barcode: '',
        categoryId: '',
        unit: '' as Unit | '',
        costPrice: '',
        retailPrice: '',
        taxRate: '0',
        stockQty: '',
        alertThreshold: '5',
        supplierRef: '',
        description: '',
        isActive: true,
        showInPos: true,
        trackStock: true,
        isFavorite: false,
        imageFile: null,
        imagePreview: null,
      })
      generateNextSku().then((sku) => {
        setForm((prev) => ({ ...prev, sku }))
        setSkuCheck({ valid: true, checked: true })
      })
    }
    setErrors({})
    setSkuCheck({ valid: true, checked: false })
    setBarcodeCheck({ valid: true, checked: false })
    setCurrentStep(1)
    setSearchQuery('')
  }

  const handleSubmit = async () => {
    if (!skuCheck.valid) {
      toast.error('SKU invalide')
      return
    }

    if (!form.categoryId || form.categoryId.trim() === '') {
      toast.error('Veuillez sélectionner une catégorie')
      return
    }

    const input: ProductInput = {
      sku: form.sku.trim(),
      barcode: form.barcode.trim() || null,
      nameAr: form.nameFr.trim() || '',
      nameFr: form.nameFr.trim() || '',
      categoryId: form.categoryId.trim(),
      unit: form.unit as Unit,
      costPrice: Math.round(costNum * 100),
      retailPrice: Math.round(retailNum * 100),
      stockQty: parseInt(form.stockQty) || 0,
      alertThreshold: parseInt(form.alertThreshold) || 0,
      taxRate: taxNum,
      supplierName: form.supplierRef.trim() || null,
      description: form.description.trim() || null,
      isActive: form.isActive,
      showInPos: form.showInPos,     // ✅ AJOUTÉ
      trackStock: form.trackStock,   // ✅ AJOUTÉ
      isFavorite: form.isFavorite,   // ✅ AJOUTÉ
    }

    const validation = validateProductInput(input)
    if (!validation.valid) {
      setErrors({})
      toast.error('Erreur de validation: ' + validation.errors.join(' / '))
      return
    }

    setLoading(true)
    try {
      let imagePath: string | null = null
      if (form.imageFile) {
        imagePath = await uploadProductImage(form.imageFile)
      } else if (isEditMode && existingProduct?.imagePath) {
        imagePath = existingProduct.imagePath
      }

      if (isEditMode && productId) {
        await updateProduct(productId, { ...input, imagePath })
        toast.success('Produit mis à jour avec succès')
      } else {
        await createProduct({ ...input, imagePath })
        toast.success('Produit enregistré avec succès')
      }
      router.push('/dashboard/produits')
    } catch (err: any) {
      console.error('Erreur complète:', err)
      const msg = err?.message || err?.toString() || 'Erreur inconnue'
      toast.error('Erreur: ' + msg)
    } finally {
      setLoading(false)
    }
  }

  const categoryName = categories.find((c) => c.id === form.categoryId)?.nameFr

  const handleAddCategoryFromSelect = () => {
    setCategoryDialogOpen(true)
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col relative">
        <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/dashboard/produits')}
              className="rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/20"
            >
              <ArrowLeft className="h-5 w-5 text-slate-500 dark:text-gray-400" />
            </Button>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-50">
                {isEditMode ? 'Modifier le produit' : 'Ajouter un produit'}
              </h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-gray-400">
                {isEditMode ? 'Modifiez les informations du produit' : 'Créez une nouvelle fiche produit'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(!previewOpen)}
              className={`gap-2 rounded-xl border-slate-200 dark:border-gray-700 font-bold transition-all ${
                previewOpen
                  ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-300'
                  : 'text-slate-600 dark:text-gray-400'
              }`}
            >
              <Eye className="h-4 w-4" />
              {previewOpen ? 'Masquer' : 'Aperçu'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetForm}
              disabled={loading || loadingProduct}
              className="gap-2 text-slate-500 dark:text-gray-400 hover:text-red-500 font-bold rounded-xl"
            >
              <RotateCcw className="h-4 w-4" /> Réinitialiser
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard/produits')}
              disabled={loading}
              className="gap-2 rounded-xl border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400 font-bold"
            >
              <X className="h-4 w-4" /> Annuler
            </Button>
          </div>
        </header>

        {!isEditMode && (
          <div className="bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-800 px-6 py-3 shrink-0">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <div className="flex-1 relative">
                <Input
                  placeholder="Rechercher un produit existant (SKU ou code-barres)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 pl-4 pr-10 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchProduct()}
                />
              </div>
              <Button
                onClick={handleSearchProduct}
                disabled={searching}
                className="gap-2 rounded-xl font-bold h-10 px-4 text-white shadow-sm hover:shadow-md transition-all"
                style={{ backgroundColor: PRIMARY }}
              >
                <Search className="h-4 w-4" />
                {searching ? 'Recherche...' : 'Rechercher'}
              </Button>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1 max-w-3xl mx-auto">
              Recherchez par SKU ou code-barres pour charger les données d&apos;un produit existant
            </p>
          </div>
        )}

        {loadingProduct && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
            <span className="ml-2 text-sm text-slate-500">Chargement du produit...</span>
          </div>
        )}

        {!loadingProduct && (
          <>
            <div className="bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-800 px-6 py-5 shrink-0">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between relative">
                  <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 dark:bg-gray-700 z-0" />
                  <div
                    className="absolute top-5 left-0 h-0.5 z-0 transition-all duration-500"
                    style={{
                      width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`,
                      background: `linear-gradient(90deg, #1D4ED8, ${ORANGE})`,
                    }}
                  />
                  {STEPS.map((step) => {
                    const StepIcon = step.icon
                    const isActive = step.id === currentStep
                    const isCompleted = isStepComplete(step.id) && step.id < currentStep
                    const isPassed = step.id < currentStep
                    return (
                      <button
                        key={step.id}
                        onClick={() => {
                          if (step.id < currentStep) setCurrentStep(step.id)
                          else if (step.id === currentStep + 1 && isStepComplete(currentStep))
                            setCurrentStep(step.id)
                        }}
                        className="flex flex-col items-center gap-2 z-10 relative"
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                            isActive
                              ? 'border-blue-600 dark:border-blue-400 shadow-lg shadow-blue-200 dark:shadow-blue-900/40 scale-110'
                              : isPassed && isCompleted
                              ? 'border-orange-400'
                              : isPassed
                              ? `border-orange-400`
                              : 'border-slate-300 dark:border-gray-600'
                          }`}
                          style={{
                            background: isActive
                              ? 'linear-gradient(135deg, #1D4ED8, #1E3A8A)'
                              : isPassed && isCompleted
                              ? ORANGE_SOFT
                              : isPassed
                              ? ORANGE
                              : 'white',
                          }}
                        >
                          {isPassed && isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-white" />
                          ) : (
                            <StepIcon
                              className={`h-4 w-4 ${
                                isActive || isPassed ? 'text-white' : 'text-slate-400 dark:text-gray-500'
                              }`}
                            />
                          )}
                        </div>
                        <span
                          className={`text-xs font-bold ${
                            isActive
                              ? 'text-blue-700 dark:text-blue-400'
                              : isPassed && isCompleted
                              ? 'text-orange-600 dark:text-orange-400'
                              : isPassed
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-slate-400 dark:text-gray-500'
                          }`}
                        >
                          {step.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="max-w-3xl mx-auto p-6">
                  {/* ÉTAPE 1 */}
                  {currentStep === 1 && (
                    <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                      <CardContent className="p-6 space-y-6">
                        <SectionHeader
                          icon={Info}
                          title="Informations générales"
                          subtitle="Nom, catégorie, unité et photo du produit"
                        />

                        <div className="flex flex-col gap-5">
                          <SimpleImageUpload
                            src={form.imagePreview}
                            onUpload={handleImageUpload}
                            onRemove={() => {
                              setForm((f) => ({ ...f, imageFile: null, imagePreview: null }))
                            }}
                          />

                          <div className="grid grid-cols-2 gap-4">
                            <FieldWrap
                              label="Nom du produit"
                              required
                              className="col-span-2"
                            >
                              <Input
                                value={form.nameFr}
                                onChange={(e) => handleChange('nameFr', e.target.value)}
                                className={iCls(!!errors.nameFr)}
                              />
                              {errors.nameFr && <FErr msg={errors.nameFr} />}
                            </FieldWrap>

                            <FieldWrap label="Catégorie" required>
                              <Select
                                value={form.categoryId}
                                onValueChange={(v) => {
                                  if (v === 'add_category') {
                                    handleAddCategoryFromSelect()
                                  } else {
                                    setForm((p) => ({ ...p, categoryId: v }))
                                  }
                                }}
                              >
                                <SelectTrigger className={sCls()}>
                                  <SelectValue placeholder="Sélectionner…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories.length === 0 && (
                                    <div className="px-3 py-2 text-xs text-slate-400">
                                      Aucune catégorie
                                    </div>
                                  )}
                                  {categories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                          style={{ backgroundColor: cat.color || '#6B7280' }}
                                        />
                                        {cat.nameFr}
                                      </div>
                                    </SelectItem>
                                  ))}
                                  <SelectItem
                                    value="add_category"
                                    className="text-orange-500 font-medium hover:text-orange-600 border-t border-gray-200 pt-2 mt-1"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Plus className="h-4 w-4" />
                                      Ajouter une catégorie
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              {form.categoryId === '' && (
                                <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-1">
                                  Aucune catégorie ? Sélectionnez{' '}
                                  <span className="font-bold text-orange-500">
                                    Ajouter une catégorie
                                  </span>{' '}
                                  dans la liste
                                </p>
                              )}
                            </FieldWrap>

                            <FieldWrap label="Unité" required>
                              <Select
                                value={form.unit}
                                onValueChange={(v) => handleChange('unit', v)}
                              >
                                <SelectTrigger className={sCls()}>
                                  <SelectValue placeholder="Sélectionner" />
                                </SelectTrigger>
                                <SelectContent>
                                  {UNITS.map((u) => (
                                    <SelectItem key={u} value={u}>
                                      {t(`products.units.${u}`)}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="other">
                                    {t('products.units.other')}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </FieldWrap>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FieldWrap label="Référence fournisseur" optional>
                            <Input
                              value={form.supplierRef}
                              onChange={(e) => handleChange('supplierRef', e.target.value)}
                              className={iCls()}
                            />
                          </FieldWrap>
                          <FieldWrap label="Description" optional>
                            <Textarea
                              value={form.description}
                              onChange={(e) => handleChange('description', e.target.value)}
                              rows={2}
                              className="resize-none rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 text-sm"
                            />
                          </FieldWrap>
                        </div>

                        <StepChecklist
                          items={[
                            { label: 'Nom du produit', ok: form.nameFr.trim().length > 0 },
                            { label: 'Catégorie', ok: form.categoryId.length > 0 },
                            { label: 'Unité', ok: form.unit.length > 0 },
                          ]}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* ÉTAPE 2 */}
                  {currentStep === 2 && (
                    <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                      <CardContent className="p-6 space-y-6">
                        <SectionHeader
                          icon={Scan}
                          title="Identifiants du produit"
                          subtitle="SKU interne et code-barres"
                        />
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-sm font-extrabold text-slate-600 dark:text-gray-300 flex items-center gap-1">
                              SKU (Référence) <span className="text-red-500">*</span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3 w-3 text-slate-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Code interne unique du produit
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                value={form.sku}
                                onChange={(e) =>
                                  handleChange('sku', e.target.value.toUpperCase())
                                }
                                className={`font-mono ${iCls(!skuCheck.valid)}`}
                              />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={handleGenerateSku}
                                    className="shrink-0 rounded-xl border-slate-200 dark:border-gray-700 hover:bg-blue-50 h-11 w-11"
                                  >
                                    <RefreshCw className="h-4 w-4" style={{ color: PRIMARY }} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Générer automatiquement</TooltipContent>
                              </Tooltip>
                            </div>
                            {skuCheck.checked && !skuCheck.valid && (
                              <FErr msg={skuCheck.message || ''} />
                            )}
                            {skuCheck.checked && skuCheck.valid && form.sku && (
                              <p className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> SKU disponible
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-extrabold text-slate-600 dark:text-gray-300">
                              Code-barres (EAN/UPC){' '}
                              <span className="text-xs text-slate-400 font-normal">
                                (optionnel)
                              </span>
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                value={form.barcode}
                                onChange={(e) => handleChange('barcode', e.target.value)}
                                className={`font-mono ${iCls(!barcodeCheck.valid)}`}
                                placeholder=""
                              />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setScannerOpen(true)}
                                    className="shrink-0 rounded-xl border-slate-200 dark:border-gray-700 hover:bg-blue-50 h-11 w-11"
                                  >
                                    <Scan className="h-4 w-4" style={{ color: PRIMARY }} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Scanner un code-barres</TooltipContent>
                              </Tooltip>
                            </div>
                            {barcodeCheck.checked && !barcodeCheck.valid && (
                              <FErr msg={barcodeCheck.message || ''} />
                            )}
                            {barcodeCheck.checked && barcodeCheck.valid && form.barcode && (
                              <p className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Code-barres valide
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            {
                              label: 'SKU auto-généré depuis code-barres',
                              color: 'text-orange-600 dark:text-orange-400',
                              bg: 'bg-orange-50 dark:bg-orange-900/20',
                              icon: RefreshCw,
                            },
                            {
                              label: 'Détection doublons temps réel',
                              color: 'text-amber-600 dark:text-amber-400',
                              bg: 'bg-amber-50 dark:bg-amber-900/20',
                              icon: AlertCircle,
                            },
                            {
                              label: 'Scan et remplissage automatique',
                              color: 'text-green-600 dark:text-green-400',
                              bg: 'bg-green-50 dark:bg-green-900/20',
                              icon: Scan,
                            },
                          ].map((item, i) => (
                            <div
                              key={i}
                              className={`rounded-xl ${item.bg} border border-slate-100 dark:border-gray-700 p-3 flex items-center gap-2`}
                            >
                              <item.icon className={`h-4 w-4 shrink-0 ${item.color}`} />
                              <span className={`text-xs font-bold ${item.color}`}>
                                {item.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* ÉTAPE 3 */}
                  {currentStep === 3 && (
                    <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                      <CardContent className="p-6 space-y-6">
                        <SectionHeader
                          icon={DollarSign}
                          title="Prix et marges"
                          subtitle="Prix d'achat, de vente et TVA"
                        />
                        <div className="grid grid-cols-3 gap-4">
                          <FieldWrap label="Prix d'achat (MAD)" optional>
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              value={form.costPrice}
                              onChange={(e) => handleChange('costPrice', e.target.value)}
                              className={iCls()}
                              onKeyDown={preventDecimal}
                            />
                          </FieldWrap>
                          <FieldWrap label="Prix de vente (MAD)" required>
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              value={form.retailPrice}
                              onChange={(e) => handleChange('retailPrice', e.target.value)}
                              className={`font-extrabold ${iCls(!!errors.retailPrice)}`}
                              onKeyDown={preventDecimal}
                            />
                            {errors.retailPrice && <FErr msg={errors.retailPrice} />}
                          </FieldWrap>
                          <FieldWrap label="TVA (%)" optional>
                            <Select
                              value={form.taxRate}
                              onValueChange={(v) => handleChange('taxRate', v)}
                            >
                              <SelectTrigger className={sCls()}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">Aucune</SelectItem>
                                {TAX_RATES.filter((r) => r > 0).map((r) => (
                                  <SelectItem key={r} value={r.toString()}>
                                    {r}%
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FieldWrap>
                        </div>
                        {(costNum > 0 || retailNum > 0) && (
                          <div className="grid grid-cols-3 gap-3">
                            <StatCard
                              icon={TrendingUp}
                              label="Marge bénéficiaire"
                              value={`${marginPercent.toFixed(0)}%`}
                              valueColor={marginPercent > 0 ? '#16A34A' : '#DC2626'}
                              iconColor={ORANGE}
                              bg="bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/30"
                            />
                            <StatCard
                              icon={DollarSign}
                              label="Profit estimé"
                              value={`${margin.toFixed(2)} MAD`}
                              valueColor="#16A34A"
                              iconColor="#16A34A"
                              bg="bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/30"
                            />
                            <StatCard
                              icon={ShoppingCart}
                              label="Prix TTC"
                              value={`${totalTTC.toFixed(2)} MAD`}
                              valueColor={PRIMARY}
                              iconColor={PRIMARY}
                              bg="bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30"
                            />
                          </div>
                        )}
                        {retailNum > 0 && margin <= 0 && costNum > 0 && (
                          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 p-3 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="text-xs font-bold text-red-600 dark:text-red-400">
                              Le prix de vente doit être supérieur au prix d'achat
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* ÉTAPE 4 */}
                  {currentStep === 4 && (
                    <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                      <CardContent className="p-6 space-y-6">
                        <SectionHeader
                          icon={ShoppingCart}
                          title="Gestion du stock"
                          subtitle="Stock initial et seuil d'alerte"
                        />
                        <div className="grid grid-cols-2 gap-6">
                          <FieldWrap label="Stock initial" optional>
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              value={form.stockQty}
                              onChange={(e) => handleChange('stockQty', e.target.value)}
                              className={iCls()}
                            />
                            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
                              Par défaut : 0
                            </p>
                          </FieldWrap>
                          <FieldWrap label="Seuil d'alerte" optional>
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              value={form.alertThreshold}
                              onChange={(e) => handleChange('alertThreshold', e.target.value)}
                              className={iCls()}
                            />
                            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
                              Alerte si stock {"<="} cette valeur
                            </p>
                          </FieldWrap>
                        </div>
                        {form.stockQty &&
                          form.alertThreshold &&
                          parseInt(form.stockQty) <= parseInt(form.alertThreshold) &&
                          parseInt(form.stockQty) > 0 && (
                            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 p-3 flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-500" />
                              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                Le produit sera indiqué "Stock faible" dès sa création
                              </span>
                            </div>
                          )}
                      </CardContent>
                    </Card>
                  )}

                  {/* ÉTAPE 5 */}
                  {currentStep === 5 && (
                    <div className="space-y-5">
                      <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                        <CardContent className="p-6">
                          <SectionHeader
                            icon={Activity}
                            title="Options supplémentaires"
                            subtitle="Visibilité et comportement du produit"
                          />
                          <div className="mt-4 space-y-1">
                            {[
                              {
                                key: 'isActive',
                                icon: Activity,
                                label: 'Produit actif après création',
                                desc: 'Visible et disponible immédiatement',
                              },
                              {
                                key: 'isFavorite',
                                icon: Star,
                                label: 'Ajouter à la liste des favoris',
                                desc: 'Apparaît en tête dans le point de vente',
                              },
                              {
                                key: 'trackStock',
                                icon: Eye,
                                label: 'Suivre les mouvements de stock',
                                desc: 'Enregistre entrées et sorties',
                              },
                              {
                                key: 'showInPos',
                                icon: ShoppingCart,
                                label: 'Afficher dans le point de vente',
                                desc: 'Sélectionnable lors des ventes',
                              },
                            ].map((opt) => {
                              const Icon = opt.icon
                              return (
                                <div
                                  key={opt.key}
                                  className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                      <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                        {opt.label}
                                      </p>
                                      <p className="text-xs text-slate-400 dark:text-gray-500">
                                        {opt.desc}
                                      </p>
                                    </div>
                                  </div>
                                  <Switch
                                    checked={form[opt.key as keyof typeof form] as boolean}
                                    onCheckedChange={(v) =>
                                      handleChange(opt.key as keyof typeof form, v)
                                    }
                                    className="data-[state=checked]:bg-blue-600"
                                  />
                                </div>
                              )
                            })}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                        <CardContent className="p-5">
                          <h4 className="font-extrabold text-xs text-slate-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                            Récapitulatif
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: 'Informations générales', ok: step1Valid },
                              { label: 'SKU disponible', ok: step2Valid },
                              { label: 'Prix cohérent', ok: step3Valid },
                              { label: 'Stock configuré', ok: true },
                            ].map((c, i) => (
                              <div
                                key={i}
                                className={`flex items-center gap-2 p-3 rounded-xl text-sm font-bold ${
                                  c.ok
                                    ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'
                                    : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                }`}
                              >
                                {c.ok ? (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-orange-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 shrink-0" />
                                )}
                                {c.label}
                              </div>
                            ))}
                          </div>
                          <div
                            className={`mt-4 flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-extrabold ${
                              isReady
                                ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200'
                                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200'
                            }`}
                          >
                            {isReady ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-orange-500" /> Prêt à être enregistré
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-4 w-4" /> Complétez les étapes
                                précédentes
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            <footer className="shrink-0 bg-white dark:bg-gray-900 border-t border-slate-200 dark:border-gray-800 px-6 py-4">
              <div className="max-w-3xl mx-auto flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1 || loading}
                  className="gap-2 rounded-xl border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400 font-bold h-11 px-6"
                >
                  <ChevronLeft className="h-4 w-4" /> Retour
                </Button>

                <div className="flex items-center gap-2">
                  {STEPS.map((s) => (
                    <div
                      key={s.id}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        s.id === currentStep ? 'w-8' : 'w-2'
                      }`}
                      style={{
                        backgroundColor:
                          s.id === currentStep
                            ? PRIMARY
                            : isStepComplete(s.id)
                            ? ORANGE_SOFT
                            : '#CBD5E1',
                      }}
                    />
                  ))}
                </div>

                {currentStep < STEPS.length ? (
                  <Button
                    onClick={nextStep}
                    disabled={!canProceed || loading}
                    className="gap-2 rounded-xl font-bold h-11 px-6 text-white transition-all hover:scale-[1.02]"
                    style={{
                      background: canProceed
                        ? 'linear-gradient(135deg, #1D4ED8, #1E3A8A)'
                        : undefined,
                    }}
                  >
                    Continuer <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={loading || !isReady}
                    className="gap-2 px-8 h-11 font-extrabold rounded-xl text-white transition-all hover:scale-[1.02]"
                    style={{
                      background: isReady
                        ? 'linear-gradient(135deg, #1D4ED8, #1E3A8A)'
                        : undefined,
                    }}
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {loading
                      ? 'Enregistrement…'
                      : isEditMode
                      ? 'Mettre à jour'
                      : 'Enregistrer le produit'}
                  </Button>
                )}
              </div>
            </footer>
          </>
        )}
      </div>

      {/* ─── Panneau d'aperçu coulissant (à droite) ─── */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white dark:bg-gray-900 shadow-2xl border-l border-slate-200 dark:border-gray-700 z-50 transition-transform duration-300 ease-in-out ${
          previewOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Aperçu du produit</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPreviewOpen(false)}
              className="rounded-full hover:bg-slate-100 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800 flex-shrink-0">
                  {form.imagePreview ? (
                    <img src={form.imagePreview} alt="Aperçu" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Package className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{form.nameFr || '(Nom non défini)'}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">SKU : {form.sku || '—'}</p>
                  {form.barcode && <p className="text-sm text-gray-500 dark:text-gray-400">Code‑barres : {form.barcode}</p>}
                </div>
              </div>

              <Separator className="bg-gray-200 dark:bg-gray-700" />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Catégorie</p>
                  <p className="font-medium">{categoryName || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Unité</p>
                  <p className="font-medium">{form.unit ? t(`products.units.${form.unit as Unit}`) : '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Prix d'achat</p>
                  <p className="font-medium">{costNum > 0 ? `${costNum.toFixed(2)} MAD` : '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Prix de vente</p>
                  <p className="font-medium text-blue-600 dark:text-blue-400">{retailNum > 0 ? `${retailNum.toFixed(2)} MAD` : '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">TVA</p>
                  <p className="font-medium">{taxNum > 0 ? `${taxNum}%` : '0%'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Prix TTC</p>
                  <p className="font-medium text-green-600 dark:text-green-400">{totalTTC > 0 ? `${totalTTC.toFixed(2)} MAD` : '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Stock initial</p>
                  <p className="font-medium">{form.stockQty || '0'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Seuil d'alerte</p>
                  <p className="font-medium">{form.alertThreshold || '5'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 dark:text-gray-400">Description</p>
                  <p className="font-medium text-sm">{form.description || '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 dark:text-gray-400">Statut</p>
                  <Badge className="border-0" variant={form.isActive ? 'default' : 'secondary'}>
                    {form.isActive ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Overlay pour fermer le panneau en cliquant à l'extérieur */}
      {previewOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/50 z-40 transition-opacity"
          onClick={() => setPreviewOpen(false)}
        />
      )}

      <AddCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        onSuccess={async (newId) => {
          if (newId) {
            await seedDefaultCategories()
            const cats = await getAllCategories()
            setCategories(cats)
            setForm((prev) => ({ ...prev, categoryId: newId }))
          }
        }}
      />

      <BarcodeScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
      />
    </TooltipProvider>
  )
}

// ─── Composants auxiliaires ──────────────────────────────────────────────

function preventDecimal(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === '.' || e.key === ',') {
    e.preventDefault()
  }
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-gray-700">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
        style={{ background: 'linear-gradient(135deg, #1D4ED8, #1E3A8A)' }}
      >
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <h3 className="font-extrabold text-gray-900 dark:text-gray-50">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-gray-400">{subtitle}</p>
      </div>
    </div>
  )
}

function FieldWrap({ label, required, optional, children, className }: {
  label: string
  required?: boolean
  optional?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`space-y-1.5 ${className || ''}`}>
      <Label className="text-sm font-extrabold text-slate-600 dark:text-gray-300">
        {label}{' '}
        {required && <span className="text-red-500">*</span>}
        {optional && <span className="text-xs text-slate-400 font-normal">(optionnel)</span>}
      </Label>
      {children}
    </div>
  )
}

function FErr({ msg }: { msg: string }) {
  return (
    <p className="text-xs font-bold text-red-500 flex items-center gap-1 mt-1">
      <AlertCircle className="h-3 w-3" /> {msg}
    </p>
  )
}

function StepChecklist({ items }: { items: { label: string; ok: boolean }[] }) {
  return (
    <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 p-3 flex flex-wrap gap-2 items-center">
      <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Requis :</span>
      {items.map((f, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
            f.ok
              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
              : 'bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400'
          }`}
        >
          {f.ok ? <CheckCircle2 className="h-3 w-3 text-orange-500" /> : <AlertCircle className="h-3 w-3" />} {f.label}
        </span>
      ))}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, valueColor, iconColor, bg }: {
  icon: any
  label: string
  value: string
  valueColor: string
  iconColor: string
  bg: string
}) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col items-center gap-1 ${bg}`}>
      <Icon className="h-5 w-5" style={{ color: iconColor }} />
      <span className="text-xs font-bold text-slate-500 dark:text-gray-400">{label}</span>
      <span className="text-xl font-extrabold" style={{ color: valueColor }}>{value}</span>
    </div>
  )
}

function iCls(err?: boolean) {
  return `h-11 rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 font-semibold text-sm ${err ? 'border-red-500' : ''}`
}

function sCls() {
  return 'h-11 rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 font-semibold text-sm'
}