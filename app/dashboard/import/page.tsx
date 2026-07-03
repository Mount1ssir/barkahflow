'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Upload, Download, FileSpreadsheet } from 'lucide-react'
import { importProductsFromCSV } from '@/lib/import-export-data'

const GOLD = '#D4A017'
const DARK_BLUE = '#1D4ED8'

export default function ImportPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast.error('Veuillez sélectionner un fichier CSV')
        return
      }
      setFile(file)
    }
  }

  const handleImport = async () => {
    if (!file) {
      toast.error('Veuillez sélectionner un fichier')
      return
    }
    setLoading(true)
    try {
      const result = await importProductsFromCSV(file)
      toast.success(`${result.imported} produits importés${result.skipped > 0 ? `, ${result.skipped} ignorés` : ''}`)
      router.push('/dashboard/produits')
    } catch (error: any) {
      console.error(error)
      toast.error(error?.message || 'Erreur lors de l\'import')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import / Export CSV</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Importez ou exportez vos données</p>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" style={{ color: GOLD }} />
            Importer des produits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="csv-file" className="text-sm font-medium">
              Sélectionner un fichier CSV
            </Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="rounded-xl border-gray-200 dark:border-gray-700 h-11"
            />
          </div>
          {file && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium">{file.name}</span>
              <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              className="gap-2 rounded-xl text-white"
              style={{ background: `linear-gradient(135deg, ${DARK_BLUE}, ${GOLD})` }}
              onClick={handleImport}
              disabled={!file || loading}
            >
              {loading ? 'Importation...' : 'Importer'}
            </Button>
            <Button
              variant="outline"
              className="gap-2 rounded-xl"
              onClick={() => {
                const template = 'sku,nameAr,nameFr,retailPrice,costPrice,unit,stockQty,alertThreshold,taxRate,barcode\n'
                const blob = new Blob([template], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'template_produits.csv'
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              <Download className="h-4 w-4" />
              Télécharger le modèle
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}