'use client'

import { Guard } from '@/components/rbac/Guard'
import { PERMISSIONS } from '@/lib/rbac'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Building2, FileText, CreditCard, Calendar, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { getCompanySettings, updateCompanySettings, type CompanySettings } from '@/lib/company-settings'

const BLUE = '#3B82F6'

function EntrepriseSettingsContent() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await getCompanySettings()
      setSettings(data)
      if (data.logoUrl) {
        setLogoPreview(data.logoUrl)
      }
    } catch (error) {
      console.error('Erreur chargement paramètres:', error)
      toast.error('Erreur chargement paramètres')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof CompanySettings, value: string | number) => {
    if (!settings) return
    setSettings({ ...settings, [field]: value })
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5 Mo")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setLogoPreview(base64)
      if (settings) {
        setSettings({ ...settings, logoUrl: base64 })
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const updated = await updateCompanySettings(settings)
      setSettings(updated)
      if (updated.logoUrl) {
        setLogoPreview(updated.logoUrl)
      }
      toast.success('Paramètres enregistrés avec succès')
    } catch (error: any) {
      console.error(error)
      toast.error("Erreur lors de l'enregistrement : " + (error?.message || 'inconnue'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <h2 className="text-xl font-bold text-red-500">Impossible de charger les paramètres</h2>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" onClick={() => router.push('/dashboard/settings')} className="gap-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" />
          Retour aux paramètres
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-6 w-6" style={{ color: BLUE }} />
            Informations entreprise
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Gérez les informations de votre boutique
          </p>
        </div>
      </div>

      {/* Contenu */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-500" />
            Informations générales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nom de l'entreprise</Label>
              <Input
                value={settings.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Ville</Label>
              <Input
                value={settings.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="rounded-xl h-11"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              Adresse
            </Label>
            <Input
              value={settings.address}
              onChange={(e) => handleChange('address', e.target.value)}
              className="rounded-xl h-11"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                Téléphone
              </Label>
              <Input
                value={settings.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                Email
              </Label>
              <Input
                value={settings.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="rounded-xl h-11"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              Site web
            </Label>
            <Input
              value={settings.website}
              onChange={(e) => handleChange('website', e.target.value)}
              className="rounded-xl h-11"
            />
          </div>

          {/* Upload du logo */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Logo de l'entreprise</Label>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-center text-gray-400">
                    <span className="text-xs">Aucun logo</span>
                  </div>
                )}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <Button variant="outline" className="rounded-xl" onClick={() => fileInputRef.current?.click()}>
                  Choisir une image
                </Button>
                {logoPreview && (
                  <Button
                    variant="ghost"
                    className="text-red-500 hover:text-red-600 ml-2"
                    onClick={() => {
                      setLogoPreview('')
                      if (settings) setSettings({ ...settings, logoUrl: '' })
                    }}
                  >
                    Supprimer
                  </Button>
                )}
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP - Max 5 Mo</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coordonnées bancaires */}
      <Card className="rounded-2xl border shadow-sm mt-6">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-gray-500" />
            Coordonnées bancaires
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Banque</Label>
              <Input
                value={settings.bankName}
                onChange={(e) => handleChange('bankName', e.target.value)}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">RIB</Label>
              <Input
                value={settings.rib}
                onChange={(e) => handleChange('rib', e.target.value)}
                className="rounded-xl h-11"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conditions de paiement */}
      <Card className="rounded-2xl border shadow-sm mt-6">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            Conditions de paiement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Délai de paiement par défaut (jours)</Label>
            <Input
              type="number"
              min="0"
              value={settings.defaultPaymentTermsDays}
              onChange={(e) => handleChange('defaultPaymentTermsDays', parseInt(e.target.value) || 0)}
              className="rounded-xl h-11 max-w-[200px]"
            />
            <p className="text-xs text-gray-400">
              Utilisé pour calculer automatiquement la date d'échéance de chaque nouvelle facture.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-gray-400" />
              Mention légale — pénalités de retard
            </Label>
            <Textarea
              value={settings.latePaymentPenaltyText}
              onChange={(e) => handleChange('latePaymentPenaltyText', e.target.value)}
              rows={2}
              className="rounded-xl resize-none"
              placeholder="Tout retard de paiement entraîne l'application de pénalités au taux légal en vigueur..."
            />
            <p className="text-xs text-gray-400">
              Ce texte apparaît en bas de chaque facture non entièrement payée.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end mt-6">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl text-white px-8 h-11"
          style={{ backgroundColor: BLUE }}
        >
          {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
        </Button>
      </div>
    </div>
  )
}

export default function EntrepriseSettingsPage() {
  return (
    <Guard permission={PERMISSIONS.SETTINGS_COMPANY} redirectTo="/dashboard/settings">
      <EntrepriseSettingsContent />
    </Guard>
  )
}