// app/auth/reset-pin-confirm/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/src/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { setPinCode } from '@/lib/pin-storage'
import { Eye, EyeOff } from 'lucide-react'

export default function ResetPinConfirmPage() {
  const router = useRouter()
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPin, setShowPin] = useState(false)

  const handleSetPin = async () => {
    if (!/^\d{4,6}$/.test(newPin)) {
      toast.error('Le PIN doit contenir entre 4 et 6 chiffres')
      return
    }
    if (newPin !== confirmPin) {
      toast.error('Les deux codes PIN ne correspondent pas')
      return
    }

    setLoading(true)
    try {
      await setPinCode(newPin)
      toast.success('PIN réinitialisé avec succès')
      await supabase.auth.signOut()
      router.replace('/')
    } catch (error: any) {
      toast.error(error?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
      <Card className="max-w-md w-full rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-center">Nouveau code PIN</CardTitle>
          <p className="text-center text-sm text-gray-500">
            Choisissez un nouveau code PIN à 4-6 chiffres.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nouveau PIN (4-6 chiffres)</Label>
              <div className="relative">
                <Input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  className="rounded-xl text-center text-lg tracking-widest pr-10"
                  placeholder="1234"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Confirmer</Label>
              <Input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="rounded-xl text-center text-lg tracking-widest"
                placeholder="1234"
              />
            </div>
            <Button onClick={handleSetPin} disabled={loading} className="w-full rounded-xl">
              {loading ? 'Enregistrement...' : 'Enregistrer le nouveau PIN'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}