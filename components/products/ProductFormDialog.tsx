'use client'

import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Building2,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Save,
  Star,
  Activity,
  Eye,
  Layers,
  RotateCcw,
  PenLine,
  Scan,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  createProduct,
  updateProduct,
  generateNextSku,
  isSkuTaken,
  isBarcodeTaken,
  validateProductInput,
  type ProductInput,
  type Product,
} from '@/lib/products-data'
import { getAllCategories, seedDefaultCategories, type Category } from '@/lib/categories-data'
import { uploadProductImage } from '@/lib/photo-upload'
import { getDisplayUrl } from '@/lib/photo-capture'
import { AddCategoryDialog } from '@/components/products/AddCategoryDialog'

const UNITS = ['piece', 'kg', 'g', 'l', 'ml', 'box', 'carton'] as const
type Unit = (typeof UNITS)[number]
const TAX_RATES = [0, 7, 10, 14, 20]
const GOLD = '#D4A017'
const PRIMARY = '#1D4ED8'
const PRIMARY_DARK = '#1E3A8A'

const STEPS = [
  { id: 1, label: 'Informations', icon: Info },
  { id: 2, label: 'Identifiants', icon: Scan },
  { id: 3, label: 'Prix', icon: DollarSign },
  { id: 4, label: 'Stock', icon: ShoppingCart },
  { id: 5, label: 'Options', icon: Activity },
]

interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productToEdit?: Product | null
  onSuccess?: () => void
}

export function ProductFormDialog({
  open,
  onOpenChange,
  productToEdit,
  onSuccess,
}: ProductFormDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [categoryVersion, setCategoryVersion] = useState(0)
  const [currentStep, setCurrentStep] = useState(1)
  const [previewOpen, setPreviewOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    nameAr: '',
    nameFr: '',
    sku: '',
    barcode: '',
    categoryId: '',
    unit: 'piece' as Unit,
    costPrice: '',
    retailPrice: '',
    taxRate: '0',
    stockQty: '',
    alertThreshold: '5',
    supplierRef: '',
    description: '',
    tags: '',
    isActive: true,
    showInPos: true,
    trackStock: true,
    isFavorite: false,
    imageFile: null as File | null,
    imagePreview: null as string | null,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [skuCheck, setSkuCheck] = useState<{ valid: boolean; message?: string; checked: boolean }>({ valid: true, checked: false })
  const [barcodeCheck, setBarcodeCheck] = useState<{ valid: boolean; message?: string; checked: boolean }>({ valid: true, checked: false })

  const costNum = parseFloat(form.costPrice) || 0
  const retailNum = parseFloat(form.retailPrice) || 0
  const taxNum = parseFloat(form.taxRate) || 0
  const margin = retailNum - costNum
  const marginPercent = costNum > 0 ? (margin / costNum) * 100 : 0
  const taxAmount = (retailNum * taxNum) / 100
  const totalTTC = retailNum + taxAmount

  const step1Valid = form.nameFr.trim().length > 0 && form.categoryId.length > 0 && form.unit.length > 0
  const step2Valid = form.sku.trim().length > 0 && skuCheck.valid
  const step3Valid = retailNum > 0 && (costNum === 0 || margin > 0)
  const step4Valid = true
  const step5Valid = true
  const isReady = step1Valid && step2Valid && step3Valid

  const isStepComplete = (step: number) => {
    if (step === 1) return step1Valid
    if (step === 2) return step2Valid
    if (step === 3) return step3Valid
    return true
  }

  const canProceed = isStepComplete(currentStep)

  const nextStep = () => {
    if (currentStep < STEPS.length) setCurrentStep(s => s + 1)
  }
  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(s => s - 1)
  }


  const loadCategories = async () => {
    await seedDefaultCategories()
    const cats = await getAllCategories()
    setCategories(cats)
    return cats
  }

  useEffect(() => {
    if (open) {
      loadCategories()
      setCurrentStep(1)
      setPreviewOpen(false)
    }
  }, [open])

  useEffect(() => {
    if (productToEdit && open) {
      setForm({
        nameAr: productToEdit.nameAr || '',
        nameFr: productToEdit.nameFr || '',
        sku: productToEdit.sku,
        barcode: productToEdit.barcode || '',
        categoryId: productToEdit.categoryId || '',
        unit: productToEdit.unit as Unit,
        costPrice: (productToEdit.costPrice / 100).toFixed(2),
        retailPrice: (productToEdit.retailPrice / 100).toFixed(2),
        taxRate: productToEdit.taxRate.toString(),
        stockQty: productToEdit.stockQty.toString(),
        alertThreshold: productToEdit.alertThreshold.toString(),
        supplierRef: productToEdit.supplierName || '',
        description: productToEdit.description || '',
        tags: '',
        isActive: productToEdit.isActive,
        showInPos: true,
        trackStock: true,
        isFavorite: false,
        imageFile: null,
        imagePreview: productToEdit.imagePath ? getDisplayUrl(productToEdit.imagePath) : null,
      })
      setSkuCheck({ valid: true, checked: true })
      setBarcodeCheck({ valid: true, checked: true })
    } else if (!productToEdit && open) {
      resetForm()
    }
    setErrors({})
  }, [productToEdit, open])

  const resetForm = () => {
    setForm({
      nameAr: '', nameFr: '', sku: '', barcode: '',
      categoryId: '', unit: 'piece', costPrice: '',
      retailPrice: '', taxRate: '0', stockQty: '',
      alertThreshold: '5', supplierRef: '', description: '',
      tags: '', isActive: true, showInPos: true,
      trackStock: true, isFavorite: false,
      imageFile: null, imagePreview: null,
    })
    setErrors({})
    setSkuCheck({ valid: true, checked: false })
    setBarcodeCheck({ valid: true, checked: false })
    setCurrentStep(1)
  }

  const handleChange = (field: keyof typeof form, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const handleCategorySuccess = async (newCategoryId?: string) => {
    await loadCategories()
    setCategoryVersion(prev => prev + 1)
    if (newCategoryId) handleChange('categoryId', newCategoryId)
  }

  useEffect(() => {
    if (!form.sku.trim()) { setSkuCheck({ valid: true, checked: false }); return }
    const timer = setTimeout(async () => {
      const taken = await isSkuTaken(form.sku, productToEdit?.id)
      setSkuCheck(taken
        ? { valid: false, checked: true, message: t('products.duplicate_sku') }
        : { valid: true, checked: true })
    }, 500)
    return () => clearTimeout(timer)
  }, [form.sku, productToEdit?.id, t])

  useEffect(() => {
    if (!form.barcode.trim()) { setBarcodeCheck({ valid: true, checked: false }); return }
    const timer = setTimeout(async () => {
      const taken = await isBarcodeTaken(form.barcode, productToEdit?.id)
      setBarcodeCheck(taken
        ? { valid: false, checked: true, message: t('products.duplicate_barcode') }
        : { valid: true, checked: true })
    }, 500)
    return () => clearTimeout(timer)
  }, [form.barcode, productToEdit?.id, t])

  const handleGenerateSku = async () => {
    const sku = await generateNextSku()
    handleChange('sku', sku)
    setSkuCheck({ valid: true, checked: true })
    toast.info(t('products.sku_generated'))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error(t('validation.image')); return }
    if (file.size > 5 * 1024 * 1024) { toast.error(t('validation.size', { size: 5120 })); return }
    const reader = new FileReader()
    reader.onload = () => setForm(f => ({ ...f, imageFile: file, imagePreview: reader.result as string }))
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleImageChange({ target: { files: [file] } } as any)
  }

  const handleSubmit = async () => {
    if (!skuCheck.valid || !barcodeCheck.valid) {
      toast.error(t('products.form.error')); return
    }
    const input: ProductInput = {
      sku: form.sku.trim(),
      barcode: form.barcode.trim() || null,
      nameAr: form.nameAr.trim() || '',
      nameFr: form.nameFr.trim() || '',
      categoryId: form.categoryId || null,
      unit: form.unit,
      costPrice: Math.round(costNum * 100),
      retailPrice: Math.round(retailNum * 100),
      stockQty: parseInt(form.stockQty) || 0,
      alertThreshold: parseInt(form.alertThreshold) || 0,
      taxRate: taxNum,
      supplierName: form.supplierRef.trim() || null,
      description: form.description.trim() || null,
      isActive: form.isActive,
    }
    const validation = validateProductInput(input)
    if (!validation.valid) {
      const errObj: Record<string, string> = {}
      validation.errors.forEach((msg) => {
        if (msg.includes('nom')) errObj.nameFr = msg
        else if (msg.includes('SKU')) errObj.sku = msg
        else if (msg.includes('vente')) errObj.retailPrice = msg
      })
      setErrors(errObj)
      toast.error(t('products.form.error'))
      return
    }
    setLoading(true)
    try {
      let imagePath: string | null = null
      if (form.imageFile) {
        imagePath = await uploadProductImage(form.imageFile)
      } else if (productToEdit?.imagePath && form.imagePreview) {
        imagePath = productToEdit.imagePath
      }
      if (productToEdit) {
        await updateProduct(productToEdit.id, { ...input, imagePath })
      } else {
        await createProduct({ ...input, imagePath })
      }
      toast.success(t('products.saved'))
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      console.error(err)
      toast.error(t('products.form.error'))
    } finally {
      setLoading(false)
    }
  }

  const categoryName = categories.find(c => c.id === form.categoryId)?.nameFr

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[1000px] w-[96vw] max-h-[92vh] p-0 rounded-2xl shadow-2xl overflow-hidden flex flex-col border-0 dark:bg-gray-900">

          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: 'linear-gradient(135deg, #1D4ED8, #1E3A8A)' }}>
                  <Package className="h-4 w-4 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-extrabold text-gray-900 dark:text-gray-50">
                    {productToEdit ? t('products.edit') : t('products.add')}
                  </DialogTitle>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                    {productToEdit ? 'Modifier les informations de ce produit' : 'Créez une nouvelle fiche produit'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={resetForm} disabled={loading}
                  className="gap-1.5 text-xs text-slate-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-xl font-bold">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Réinitialiser
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-xl h-8 w-8">
                  <X className="h-4 w-4 text-slate-500 dark:text-gray-400" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Wizard Steps Bar */}
          <div className="bg-slate-50 dark:bg-gray-950 border-b border-slate-200 dark:border-gray-800 px-6 py-3 shrink-0">
            <div className="flex items-center justify-between relative">
              {/* Base line */}
              <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-200 dark:bg-gray-700 z-0" />
              {/* Progress line */}
              <div
                className="absolute top-4 left-0 h-0.5 z-0 transition-all duration-500"
                style={{
                  width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`,
                  background: 'linear-gradient(90deg, #1D4ED8, #D4A017)',
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
                      else if (step.id === currentStep + 1 && isStepComplete(currentStep)) setCurrentStep(step.id)
                    }}
                    className="flex flex-col items-center gap-1.5 z-10 relative"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                        isActive ? 'border-blue-600 dark:border-blue-400 shadow-md shadow-blue-200 dark:shadow-blue-900/40 scale-110' :
                        isPassed && isCompleted ? 'border-green-500 dark:border-green-400' :
                        isPassed ? 'border-amber-500 dark:border-amber-400' :
                        'border-slate-300 dark:border-gray-600'
                      }`}
                      style={{
                        background: isActive ? 'linear-gradient(135deg, #1D4ED8, #1E3A8A)' :
                          isPassed && isCompleted ? '#16A34A' :
                          isPassed ? '#D4A017' :
                          'transparent',
                        backgroundColor: (!isActive && !isPassed) ? 'white' : undefined,
                      }}
                    >
                      {isPassed && isCompleted
                        ? <CheckCircle2 className="h-4 w-4 text-white" />
                        : <StepIcon className={`h-3.5 w-3.5 ${isActive || isPassed ? 'text-white' : 'text-slate-400 dark:text-gray-500'}`} />
                      }
                    </div>
                    <span className={`text-[10px] font-bold transition-colors ${
                      isActive ? 'text-blue-700 dark:text-blue-400' :
                      isPassed && isCompleted ? 'text-green-600 dark:text-green-400' :
                      isPassed ? 'text-amber-600 dark:text-amber-400' :
                      'text-slate-400 dark:text-gray-500'
                    }`}>
                      {step.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            <ScrollArea className="flex-1 bg-slate-50 dark:bg-gray-950">
              <div className="p-5">

                {/* STEP 1 */}
                {currentStep === 1 && (
                  <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <CardContent className="p-5 space-y-5">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-gray-700">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1D4ED8, #1E3A8A)' }}>
                          <Info className="h-3.5 w-3.5 text-white" />
                        </div>
                        <h3 className="font-extrabold text-sm text-gray-900 dark:text-gray-50">Informations générales</h3>
                      </div>

                      <div className="flex gap-4">
                        <div
                          className="w-32 h-32 shrink-0 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors overflow-hidden dark:bg-gray-800"
                          style={{ borderColor: form.imagePreview ? PRIMARY : '#CBD5E1' }}
                          onClick={() => fileInputRef.current?.click()}
                          onDrop={handleDrop}
                          onDragOver={(e) => e.preventDefault()}
                        >
                          {form.imagePreview ? (
                            <img src={form.imagePreview} alt="aperçu" className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center gap-1.5 p-2 text-center">
                              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                <Upload className="h-5 w-5 text-blue-400 dark:text-blue-500" />
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 dark:text-gray-400">Ajouter une photo</p>
                              <p className="text-[9px] text-slate-400 dark:text-gray-500">PNG, JPG · Max 5MB</p>
                            </div>
                          )}
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />

                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-extrabold text-slate-600 dark:text-gray-300">
                              Nom du produit <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              value={form.nameFr}
                              onChange={(e) => handleChange('nameFr', e.target.value)}
                              placeholder=""
                              className={`rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 h-10 font-semibold text-sm ${errors.nameFr ? 'border-red-500' : ''}`}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-extrabold text-slate-600 dark:text-gray-300">
                              Nom en arabe <span className="text-[10px] text-slate-400 font-bold">(optionnel)</span>
                            </Label>
                            <Input
                              value={form.nameAr}
                              onChange={(e) => handleChange('nameAr', e.target.value)}
                              placeholder=""
                              dir="rtl"
                              className="rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 h-10 font-semibold text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-extrabold text-slate-600 dark:text-gray-300 flex items-center gap-1">
                              <Layers className="h-3 w-3 text-blue-600 dark:text-blue-400" /> Catégorie <span className="text-red-500">*</span>
                            </Label>
                            <div className="flex gap-1.5">
                              <Select key={categoryVersion} value={form.categoryId} onValueChange={(v) => handleChange('categoryId', v)}>
                                <SelectTrigger className="flex-1 rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 h-10 font-semibold text-sm">
                                  <SelectValue placeholder="Sélectionner" />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>{cat.nameFr}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button type="button" variant="outline" size="icon" onClick={() => setCategoryDialogOpen(true)}
                                    className="shrink-0 rounded-xl border-slate-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-10 w-10">
                                    <Plus className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ajouter une catégorie</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-extrabold text-slate-600 dark:text-gray-300 flex items-center gap-1">
                              <Package className="h-3 w-3 text-blue-600 dark:text-blue-400" /> Unité <span className="text-red-500">*</span>
                            </Label>
                            <Select value={form.unit} onValueChange={(v) => handleChange('unit', v)}>
                              <SelectTrigger className="rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 h-10 font-semibold text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UNITS.map((u) => (<SelectItem key={u} value={u}>{t(`products.units.${u}`)}</SelectItem>))}
                                <SelectItem value="other">{t('products.units.other')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-extrabold text-slate-600 dark:text-gray-300 flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-blue-600 dark:text-blue-400" /> Réf. fournisseur <span className="text-[10px] text-slate-400 font-bold">(optionnel)</span>
                          </Label>
                          <Input value={form.supplierRef} onChange={(e) => handleChange('supplierRef', e.target.value)} placeholder=""
                            className="rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 h-10 font-semibold text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-extrabold text-slate-600 dark:text-gray-300 flex items-center gap-1">
                            <PenLine className="h-3 w-3 text-blue-600 dark:text-blue-400" /> Description <span className="text-[10px] text-slate-400 font-bold">(optionnel)</span>
                          </Label>
                          <Textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)}
                            rows={2} placeholder="" className="resize-none rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 font-medium text-sm" />
                        </div>
                      </div>

                      <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 p-3 flex flex-wrap gap-2 items-center">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Requis :</span>
                        {[
                          { label: 'Nom', ok: form.nameFr.trim().length > 0 },
                          { label: 'Catégorie', ok: form.categoryId.length > 0 },
                          { label: 'Unité', ok: form.unit.length > 0 },
                        ].map((f, i) => (
                          <span key={i} className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${f.ok ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400'}`}>
                            {f.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                            {f.label}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* STEP 2 */}
                {currentStep === 2 && (
                  <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <CardContent className="p-5 space-y-5">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-gray-700">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1D4ED8, #1E3A8A)' }}>
                          <Scan className="h-3.5 w-3.5 text-white" />
                        </div>
                        <h3 className="font-extrabold text-sm text-gray-900 dark:text-gray-50">Identifiants du produit</h3>
                      </div>

                      <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <Label className="text-xs font-extrabold text-slate-600 dark:text-gray-300 flex items-center gap-1">
                            SKU (Référence) <span className="text-red-500">*</span>
                            <Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-slate-400 cursor-help" /></TooltipTrigger><TooltipContent>Code interne unique</TooltipContent></Tooltip>
                          </Label>
                          <div className="flex gap-2">
                            <Input value={form.sku} onChange={(e) => handleChange('sku', e.target.value.toUpperCase())}
                              className={`font-mono rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 h-10 font-bold text-sm ${!skuCheck.valid ? 'border-red-500' : ''}`} placeholder="" />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button type="button" variant="outline" size="icon" onClick={handleGenerateSku}
                                  className="shrink-0 rounded-xl border-slate-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-10 w-10">
                                  <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Générer automatiquement</TooltipContent>
                            </Tooltip>
                          </div>
                          {skuCheck.checked && !skuCheck.valid && <p className="text-xs font-bold text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {skuCheck.message}</p>}
                          {skuCheck.checked && skuCheck.valid && form.sku && <p className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> SKU disponible</p>}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-extrabold text-slate-600 dark:text-gray-300">
                            Code-barres (EAN/UPC) <span className="text-[10px] text-slate-400 font-bold">(optionnel)</span>
                          </Label>
                          <div className="flex gap-2">
                            <Input value={form.barcode} onChange={(e) => handleChange('barcode', e.target.value)}
                              className={`font-mono rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 h-10 font-bold text-sm ${!barcodeCheck.valid ? 'border-red-500' : ''}`} placeholder="" />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button type="button" variant="outline" size="icon" onClick={() => toast.info('Scan à venir')}
                                  className="shrink-0 rounded-xl border-slate-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-10 w-10">
                                  <Scan className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Scanner un code-barres</TooltipContent>
                            </Tooltip>
                          </div>
                          {barcodeCheck.checked && !barcodeCheck.valid && <p className="text-xs font-bold text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {barcodeCheck.message}</p>}
                          {barcodeCheck.checked && barcodeCheck.valid && form.barcode && <p className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Code-barres valide</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { icon: RefreshCw, label: 'Création automatique du SKU', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                          { icon: AlertCircle, label: 'Détection des doublons', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                          { icon: CheckCircle2, label: 'Validation intelligente', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
                        ].map((item, i) => (
                          <div key={i} className={`rounded-xl ${item.bg} border border-slate-100 dark:border-gray-700 p-2.5 flex items-center gap-2`}>
                            <item.icon className={`h-3.5 w-3.5 shrink-0 ${item.color}`} />
                            <span className={`text-[11px] font-bold ${item.color}`}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* STEP 3 */}
                {currentStep === 3 && (
                  <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <CardContent className="p-5 space-y-5">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-gray-700">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1D4ED8, #1E3A8A)' }}>
                          <DollarSign className="h-3.5 w-3.5 text-white" />
                        </div>
                        <h3 className="font-extrabold text-sm text-gray-900 dark:text-gray-50">Prix et marges</h3>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-extrabold text-slate-600 dark:text-gray-300">
                            Prix d'achat (MAD) <span className="text-[10px] text-slate-400 font-bold">(optionnel)</span>
                          </Label>
                          <Input type="number" step="0.01" min="0" value={form.costPrice} onChange={(e) => handleChange('costPrice', e.target.value)} placeholder=""
                            className="rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 h-10 font-semibold text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-extrabold text-slate-600 dark:text-gray-300">
                            Prix de vente (MAD) <span className="text-red-500">*</span>
                          </Label>
                          <Input type="number" step="0.01" min="0" value={form.retailPrice} onChange={(e) => handleChange('retailPrice', e.target.value)} placeholder=""
                            className={`rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 h-10 font-extrabold text-sm ${errors.retailPrice ? 'border-red-500' : ''}`} />
                          {errors.retailPrice && <p className="text-xs font-bold text-red-500">{errors.retailPrice}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-extrabold text-slate-600 dark:text-gray-300">
                            TVA (%) <span className="text-[10px] text-slate-400 font-bold">(optionnel)</span>
                          </Label>
                          <Select value={form.taxRate} onValueChange={(v) => handleChange('taxRate', v)}>
                            <SelectTrigger className="rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 h-10 font-semibold text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Aucune</SelectItem>
                              {TAX_RATES.filter(r => r > 0).map((rate) => (
                                <SelectItem key={rate} value={rate.toString()}>{rate}%</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {(costNum > 0 || retailNum > 0) && (
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { icon: TrendingUp, label: 'Marge', value: `${marginPercent.toFixed(0)}%`, color: marginPercent > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500', iconColor: GOLD, bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30' },
                            { icon: DollarSign, label: 'Profit estimé', value: `${margin.toFixed(2)} MAD`, color: 'text-green-600 dark:text-green-400', iconColor: '#16A34A', bg: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/30' },
                            { icon: ShoppingCart, label: 'Prix TTC', value: `${totalTTC.toFixed(2)} MAD`, color: 'text-blue-700 dark:text-blue-400', iconColor: PRIMARY, bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30' },
                          ].map((item, i) => (
                            <div key={i} className={`rounded-xl border p-3 flex flex-col items-center gap-1 ${item.bg}`}>
                              <item.icon className="h-4 w-4" style={{ color: item.iconColor }} />
                              <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400">{item.label}</span>
                              <span className={`text-base font-extrabold ${item.color}`}>{item.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {retailNum > 0 && margin <= 0 && costNum > 0 && (
                        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 p-2.5 flex items-center gap-2">
                          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                          <span className="text-xs font-bold text-red-600 dark:text-red-400">Le prix de vente doit être supérieur au prix d'achat</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* STEP 4 */}
                {currentStep === 4 && (
                  <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <CardContent className="p-5 space-y-5">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-gray-700">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1D4ED8, #1E3A8A)' }}>
                          <ShoppingCart className="h-3.5 w-3.5 text-white" />
                        </div>
                        <h3 className="font-extrabold text-sm text-gray-900 dark:text-gray-50">Gestion du stock</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-extrabold text-slate-600 dark:text-gray-300">
                            Stock initial <span className="text-[10px] text-slate-400 font-bold">(optionnel)</span>
                          </Label>
                          <Input type="number" min="0" value={form.stockQty} onChange={(e) => handleChange('stockQty', e.target.value)} placeholder=""
                            className="rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 h-10 font-semibold text-sm" />
                          <p className="text-[10px] text-slate-400 dark:text-gray-500">Quantité disponible au démarrage. Par défaut : 0</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-extrabold text-slate-600 dark:text-gray-300 flex items-center gap-1">
                            Seuil d'alerte <span className="text-[10px] text-slate-400 font-bold">(optionnel)</span>
                            <Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-slate-400 cursor-help" /></TooltipTrigger><TooltipContent>Alerte "stock faible" sous cette quantité</TooltipContent></Tooltip>
                          </Label>
                          <Input type="number" min="0" value={form.alertThreshold} onChange={(e) => handleChange('alertThreshold', e.target.value)} placeholder=""
                            className="rounded-xl border-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 h-10 font-semibold text-sm" />
                          <p className="text-[10px] text-slate-400 dark:text-gray-500">Alerte déclenchée quand stock ≤ cette valeur</p>
                        </div>
                      </div>
                      {form.stockQty && form.alertThreshold && parseInt(form.stockQty) <= parseInt(form.alertThreshold) && parseInt(form.stockQty) > 0 && (
                        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 p-2.5 flex items-center gap-2">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                            Alerte : Le produit sera indiqué "Stock faible" dès sa création (stock ≤ {form.alertThreshold})
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* STEP 5 */}
                {currentStep === 5 && (
                  <div className="space-y-4">
                    <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                      <CardContent className="p-5 space-y-1">
                        <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-gray-700">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1D4ED8, #1E3A8A)' }}>
                            <Activity className="h-3.5 w-3.5 text-white" />
                          </div>
                          <h3 className="font-extrabold text-sm text-gray-900 dark:text-gray-50">Options supplémentaires</h3>
                        </div>
                        {[
                          { key: 'isActive', icon: Activity, label: 'Produit actif après création', desc: 'Visible et disponible immédiatement' },
                          { key: 'isFavorite', icon: Star, label: 'Ajouter aux favoris', desc: 'Apparaît en tête dans le point de vente' },
                          { key: 'trackStock', icon: Eye, label: 'Suivre les mouvements de stock', desc: 'Enregistre entrées et sorties' },
                          { key: 'showInPos', icon: ShoppingCart, label: 'Afficher dans le point de vente', desc: 'Sélectionnable lors des ventes' },
                        ].map((opt) => {
                          const OptIcon = opt.icon
                          return (
                            <div key={opt.key} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                  <OptIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{opt.label}</p>
                                  <p className="text-[10px] text-slate-400 dark:text-gray-500">{opt.desc}</p>
                                </div>
                              </div>
                              <Switch
                                checked={form[opt.key as keyof typeof form] as boolean}
                                onCheckedChange={(v) => handleChange(opt.key as keyof typeof form, v)}
                                className="data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
                              />
                            </div>
                          )
                        })}
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                      <CardContent className="p-4">
                        <h4 className="font-extrabold text-xs text-slate-500 dark:text-gray-400 mb-3 uppercase tracking-wider">Récapitulatif</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: 'Informations générales', ok: step1Valid },
                            { label: 'SKU disponible', ok: step2Valid },
                            { label: 'Prix cohérent', ok: step3Valid },
                            { label: 'Stock configuré', ok: true },
                          ].map((check, i) => (
                            <div key={i} className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold ${check.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                              {check.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                              {check.label}
                            </div>
                          ))}
                        </div>
                        <div className={`mt-3 flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-extrabold ${isReady ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/30' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30'}`}>
                          {isReady
                            ? <><CheckCircle2 className="h-3.5 w-3.5" /> Prêt à être enregistré</>
                            : <><AlertCircle className="h-3.5 w-3.5" /> Retournez compléter les étapes précédentes</>}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Preview toggle button */}
            <div className="relative flex shrink-0">
              <button
                onClick={() => setPreviewOpen(v => !v)}
                className="absolute -left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-14 rounded-l-xl flex items-center justify-center shadow-md border border-r-0 border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                {previewOpen
                  ? <ChevronRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  : <ChevronLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
              </button>

              <div className={`transition-all duration-300 overflow-hidden ${previewOpen ? 'w-64' : 'w-0'}`}>
                {previewOpen && (
                  <div className="w-64 h-full border-l border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto">
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-gray-700">
                        <Eye className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        <span className="font-extrabold text-[11px] text-slate-500 dark:text-gray-400 uppercase tracking-wider">Aperçu</span>
                      </div>

                      <div className="relative">
                        <div className="h-36 w-full rounded-xl bg-slate-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-gray-700">
                          {form.imagePreview
                            ? <img src={form.imagePreview} alt="aperçu" className="w-full h-full object-contain" />
                            : <Package className="h-10 w-10 text-slate-300 dark:text-gray-600" />}
                        </div>
                        {!productToEdit && (
                          <Badge className="absolute top-2 right-2 text-[10px] rounded-full px-2 py-0.5 font-extrabold" style={{ backgroundColor: GOLD, color: '#fff' }}>
                            Nouveau
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <h4 className="font-extrabold text-base text-gray-900 dark:text-gray-50">
                          {form.nameFr || <span className="text-slate-300 dark:text-gray-600 italic text-sm">Nom du produit</span>}
                        </h4>
                        {form.nameAr && <p className="text-xs font-semibold text-slate-500 dark:text-gray-400" dir="rtl">{form.nameAr}</p>}
                        {form.sku && <Badge variant="secondary" className="font-bold text-[10px] rounded-full dark:bg-gray-700 dark:text-gray-300">SKU : {form.sku}</Badge>}
                      </div>

                      <Separator className="bg-slate-100 dark:bg-gray-700" />

                      <div className="space-y-1.5 text-xs">
                        {categoryName && <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400 font-semibold">Catégorie</span><span className="font-extrabold text-gray-900 dark:text-gray-50">{categoryName}</span></div>}
                        {form.unit && <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400 font-semibold">Unité</span><span className="font-extrabold text-gray-900 dark:text-gray-50">{t(`products.units.${form.unit}`)}</span></div>}
                        <Separator className="bg-slate-100 dark:bg-gray-700" />
                        <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400 font-semibold">Prix vente</span><span className="font-extrabold text-blue-700 dark:text-blue-400">{retailNum > 0 ? `${retailNum.toFixed(2)} MAD` : '—'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400 font-semibold">Prix achat</span><span className="font-extrabold text-gray-900 dark:text-gray-50">{costNum > 0 ? `${costNum.toFixed(2)} MAD` : '—'}</span></div>
                        {costNum > 0 && retailNum > 0 && <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400 font-semibold">Marge</span><span className={`font-extrabold ${marginPercent > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{marginPercent.toFixed(0)}%</span></div>}
                        <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400 font-semibold">Stock</span><span className="font-extrabold text-gray-900 dark:text-gray-50">{form.stockQty || '0'}</span></div>
                      </div>

                      <div className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-[10px] font-extrabold ${isReady ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/30' : 'bg-slate-50 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-gray-700'}`}>
                        {isReady ? <><CheckCircle2 className="h-3 w-3" /> Prêt</> : <><AlertCircle className="h-3 w-3" style={{ color: GOLD }} /> Incomplet</>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between shrink-0">
            <Button variant="outline" onClick={prevStep} disabled={currentStep === 1 || loading}
              className="gap-2 rounded-xl border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400 font-bold hover:bg-slate-50 dark:hover:bg-gray-800 h-10 px-5">
              <ChevronLeft className="h-4 w-4" />
              Retour
            </Button>

            <div className="flex items-center gap-1.5">
              {STEPS.map((s) => (
                <div key={s.id} className={`h-1.5 rounded-full transition-all duration-300 ${s.id === currentStep ? 'w-7' : 'w-2'}`}
                  style={{ backgroundColor: s.id === currentStep ? PRIMARY : isStepComplete(s.id) ? '#16A34A' : '#CBD5E1' }} />
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}
                className="gap-1.5 rounded-xl border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400 font-bold hover:bg-slate-50 dark:hover:bg-gray-800 h-10 px-4">
                <X className="h-4 w-4" /> Annuler
              </Button>
              {currentStep < STEPS.length ? (
                <Button onClick={nextStep} disabled={!canProceed || loading}
                  className="gap-2 rounded-xl font-bold h-10 px-5 text-white transition-all hover:scale-[1.02]"
                  style={{ background: canProceed ? 'linear-gradient(135deg, #1D4ED8, #1E3A8A)' : undefined }}>
                  Continuer <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading || !isReady}
                  className="gap-2 px-6 h-10 font-extrabold rounded-xl transition-all hover:scale-[1.02] text-white"
                  style={{ background: isReady ? 'linear-gradient(135deg, #1D4ED8, #1E3A8A)' : undefined }}>
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {loading ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        onSuccess={handleCategorySuccess}
      />
    </TooltipProvider>
  )
}
