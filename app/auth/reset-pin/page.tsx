// app/auth/reset-pin/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/src/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Mail, Loader2, AlertCircle } from 'lucide-react'

export default function ResetPinPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    // Récupérer l'email du propriétaire
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user
      if (!user?.email) {
        setError('Vous devez être connecté')
        return
      }
      setEmail(user.email)
    })
  }, [])

  // Cooldown timer (60 secondes)
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  const handleSendReset = async () => {
    if (!email) {
      setError('Email introuvable')
      return
    }
    if (cooldown > 0) {
      toast.error(`Veuillez attendre ${cooldown} secondes avant de réessayer`)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-pin-confirm`,
      })
      if (error) throw error

      setSent(true)
      setCooldown(60) // 1 minute de cooldown
      toast.success('Email envoyé à votre adresse')
    } catch (err: any) {
      console.error(err)
      if (err.message?.includes('rate limit')) {
        setError('Trop de tentatives. Veuillez patienter quelques minutes.')
      } else {
        setError(err?.message || 'Erreur lors de l\'envoi')
      }
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="fixed inset-0 z-[100] bg-white dark:bg-zinc-900 flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full rounded-2xl shadow-xl">
          <CardHeader>
            <CardTitle className="text-center">✅ Email envoyé</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto">
                <Mail className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Un email de réinitialisation a été envoyé à <br />
                <strong>{email}</strong>
              </p>
              <p className="text-sm text-gray-400">
                Ouvrez l'email sur votre téléphone ou un autre appareil, <br />
                puis cliquez sur le lien pour réinitialiser votre code PIN.
              </p>
              <Button
                onClick={() => router.push('/dashboard')}
                variant="outline"
                className="w-full mt-2 rounded-xl"
              >
                Retourner à l'écran de verrouillage
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-zinc-900 flex flex-col items-center justify-center p-6">
      <Card className="max-w-md w-full rounded-2xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-center">Réinitialiser le code PIN</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto">
              <Mail className="h-8 w-8 text-blue-500" />
            </div>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Un email de réinitialisation sera envoyé à votre adresse :<br />
              <strong className="text-gray-700 dark:text-gray-300">{email}</strong>
            </p>
            {cooldown > 0 && (
              <p className="text-xs text-gray-400">
                Attendez {cooldown} secondes avant de renvoyer un email.
              </p>
            )}
            <Button
              onClick={handleSendReset}
              disabled={loading || cooldown > 0}
              className="w-full rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                'Envoyer le lien de réinitialisation'
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push('/dashboard')}
              className="w-full rounded-xl"
            >
              Retour
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}