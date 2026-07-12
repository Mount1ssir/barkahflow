'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ArrowLeft, Save, CreditCard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { createClient } from '@/lib/client-data'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

const DARK_NAVY = '#0F172A'

export default function NewClientPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [phone, setPhone] = useState<string | undefined>('')
  const [creditLimit, setCreditLimit] = useState('')
  const [form, setForm] = useState({
    fullName: '',
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

    const parsedLimit = parseFloat(creditLimit)
    if (creditLimit.trim() && (isNaN(parsedLimit) || parsedLimit < 0)) {
      toast.error('La limite de crédit doit être un nombre positif')
      return
    }

    setLoading(true)
    try {
      await createClient({
        ...form,
        phone: phone || '',
        creditLimit: creditLimit.trim() ? Math.round(parsedLimit * 100) : null,
      })
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
      {/* ── Style pour aligner le champ téléphone sur les autres inputs ── */}
      <style jsx global>{`
        .phone-input-custom {
          display: flex;
          align-items: center;
          height: 44px;
          border-radius: 0.75rem;
          border: 1px solid rgb(229 231 235);
          background: transparent;
          padding: 0 0.75rem;
          transition: border-color 0.15s ease;
        }
        .dark .phone-input-custom {
          border-color: rgb(55 65 81);
        }
        .phone-input-custom:focus-within {
          border-color: rgb(15 23 42);
          outline: 2px solid transparent;
          outline-offset: 2px;
          box-shadow: 0 0 0 1px rgb(15 23 42);
        }
        .phone-input-custom .PhoneInputInput {
          border: none;
          background: transparent;
          outline: none;
          font-size: 0.875rem;
          height: 100%;
          color: inherit;
        }
        .phone-input-custom .PhoneInputCountry {
          margin-right: 0.5rem;
        }
        .phone-input-custom .PhoneInputCountrySelect {
          background: transparent;
        }
      `}</style>

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
            <PhoneInput
              international
              defaultCountry="MA"
              value={phone}
              onChange={setPhone}
              className="phone-input-custom"
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

          {/* ── Ajout : Limite de crédit ── */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-gray-400" />
              Limite de crédit (MAD) <span className="text-gray-400 font-normal">(optionnel)</span>
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex: 500.00"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              className="rounded-xl h-11 border-gray-200 dark:border-gray-700"
            />
            <p className="text-xs text-gray-400">
              Montant maximum de dette autorisé pour ce client. Laissez vide pour ne fixer aucune limite.
            </p>
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