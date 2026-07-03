'use client'

import { useState } from 'react'
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
import { toast } from 'sonner'
import { createCategory } from '@/lib/categories-data'
import { ColorPicker } from '@/components/ui/color-picker'
import { Package } from 'lucide-react'

interface AddCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (newCategoryId?: string) => void
}

export function AddCategoryDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddCategoryDialogProps) {
  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [color, setColor] = useState('#3B82F6')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Veuillez saisir un nom de catégorie')
      return
    }
    setLoading(true)
    try {
      const newCategoryId = await createCategory(
        name.trim(),
        nameAr.trim() || undefined,
        color
      )
      toast.success('Catégorie créée avec succès')
      setName('')
      setNameAr('')
      setColor('#3B82F6')
      onOpenChange(false)
      if (onSuccess) onSuccess(newCategoryId)
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl shadow-2xl border-0 bg-white dark:bg-gray-900 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold text-gray-900 dark:text-gray-50 flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #1D4ED8, #1E3A8A)' }}
            >
              <Package className="h-4 w-4 text-white" />
            </div>
            Ajouter une catégorie
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Nom FR */}
          <div className="space-y-1.5">
            <Label htmlFor="categoryName" className="text-sm font-extrabold text-gray-700 dark:text-gray-200">
              Nom de la catégorie <span className="text-red-500">*</span>
            </Label>
            <Input
              id="categoryName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Épicerie"
              className="rounded-xl border-slate-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-600 dark:bg-gray-800 dark:text-gray-100 font-bold h-11"
              autoFocus
            />
          </div>

          {/* Nom AR */}
          <div className="space-y-1.5">
            <Label htmlFor="categoryNameAr" className="text-sm font-extrabold text-gray-700 dark:text-gray-200">
              Nom en arabe{' '}
              <span className="text-slate-400 dark:text-gray-500 text-xs font-bold">
                (optionnel)
              </span>
            </Label>
            <Input
              id="categoryNameAr"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="مثال: بقالة"
              dir="rtl"
              className="rounded-xl border-slate-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-600 dark:bg-gray-800 dark:text-gray-100 font-bold h-11"
            />
          </div>

          {/* Couleur avec le nouveau sélecteur */}
          <div className="space-y-1.5">
            <Label className="text-sm font-extrabold text-gray-700 dark:text-gray-200">
              Couleur{' '}
              <span className="text-slate-400 dark:text-gray-500 text-xs font-bold">
                (optionnel)
              </span>
            </Label>
            <ColorPicker
              value={color}
              onChange={(newColor) => setColor(newColor)}
            />
          </div>

          {/* Aperçu */}
          <div className="rounded-xl bg-slate-50 dark:bg-gray-800 p-3 border border-slate-200 dark:border-gray-700 flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex-shrink-0 border-2 border-white shadow-sm"
              style={{ backgroundColor: color }}
            />
            <div>
              <p className="font-extrabold text-gray-900 dark:text-gray-50">
                {name || (
                  <span className="text-slate-400 italic font-normal text-sm">
                    Nom de la catégorie
                  </span>
                )}
              </p>
              {nameAr && (
                <p className="text-sm font-bold text-slate-500 dark:text-gray-400" dir="rtl">
                  {nameAr}
                </p>
              )}
            </div>
          </div>
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
            disabled={loading || !name.trim()}
            className="rounded-xl font-extrabold text-white"
            style={{ background: 'linear-gradient(135deg, #1D4ED8, #1E3A8A)' }}
          >
            {loading ? 'Création...' : 'Créer la catégorie'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}