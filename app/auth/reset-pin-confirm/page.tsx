// app/auth/reset-pin-confirm/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/src/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { setPinCode } from '@/lib/pin-storage'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function ResetPinConfirmPage() {
  const router = useRouter()
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [valid, setValid] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      // 🔥 Vérifier si l'utilisateur est authentifié via le lien (hash)
      const hash = window.location.hash
      if (hash) {
        try {
          const params = new URLSearchParams(hash.substring(1))
          const accessToken = params.get('access_token')
          if (accessToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: '',
            })
            if (error) throw error
            setUserEmail(data.session?.user?.email || '')
            setValid(true)
            toast.success('Vérification réussie')
          } else {
            toast.error('Lien invalide')
            router.push('/auth/reset-pin')
          }
        } catch (error) {
          console.error(error)
          toast.error('Lien invalide ou expiré')
          router.push('/auth/reset-pin')
        }
      } else {
        // Essayer de récupérer la session existante
        const { data } = await supabase.auth.getSession()
        if (data.session?.user) {
          setUserEmail(data.session.user.email || '')
          setValid(true)
        } else {
          toast.error('Vous devez être authentifié')
          router.push('/auth/reset-pin')
        }
      }
      setChecking(false)
    }
    checkAuth()
  }, [])

  const handleSetPin = async () => {
    if (!valid) {
      toast.error('Veuillez valider votre identité d\'abord')
      return
    }
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
      router.push('/dashboard')
    } catch (error: any) {
      toast.error(error?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!valid) {
    return null // sera redirigé
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
      <Card className="max-w-md w-full rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-center">Nouveau code PIN</CardTitle>
          <p className="text-center text-sm text-gray-500">
            Pour {userEmail}
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
              <div className="relative">
                <Input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
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
            <Button
              onClick={handleSetPin}
              disabled={loading}
              className="w-full rounded-xl"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer le nouveau PIN'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}