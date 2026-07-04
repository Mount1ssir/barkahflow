'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ArrowLeft, Save } from 'lucide-react'
import { createClient } from '@/lib/client-data'

const DARK_NAVY = '#0F172A'

export default function NewClientPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  })

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!form.fullName.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }
    setLoading(true)
    try {
      await createClient(form)
      toast.success('Client créé avec succès')
      router.push('/dashboard/clients')
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.push('/dashboard/clients')} className="gap-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ajouter un client</h1>
      </div>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Informations du client</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Nom complet <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              className="rounded-xl h-11 border-gray-200 dark:border-gray-700"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Téléphone
            </Label>
            <Input
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="rounded-xl h-11 border-gray-200 dark:border-gray-700"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </Label>
            <Input
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="rounded-xl h-11 border-gray-200 dark:border-gray-700"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Adresse
            </Label>
            <Input
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              className="rounded-xl h-11 border-gray-200 dark:border-gray-700"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Notes
            </Label>
            <Textarea
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              className="rounded-xl border-gray-200 dark:border-gray-700 resize-none"
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-xl text-white h-11"
            style={{ backgroundColor: DARK_NAVY }}
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Création...' : 'Créer le client'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}