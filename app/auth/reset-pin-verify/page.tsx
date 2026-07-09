'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/src/lib/supabase'
import { PinPad } from '@/components/pin/PinPad'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Mail, Loader2, Clock, RefreshCw } from 'lucide-react'

export default function ResetPinVerifyPage() {
  const router = useRouter()
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0) // secondes restantes

  // ✅ Gestion du cooldown
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(prev => prev - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  const handleVerify = async (code: string) => {
    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        toast.error('Session expirée, reconnectez-vous')
        router.push('/')
        return
      }

      const { data, error: fnError } = await supabase.functions.invoke('verify-temp-pin', {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { pin: code },
      })

      if (fnError) throw fnError

      if (data?.valid) {
        toast.success('Code vérifié')
        router.push('/auth/reset-pin-confirm')
      } else {
        setError(true)
        toast.error(data?.error || 'Code incorrect')
        setTimeout(() => setError(false), 500)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erreur de vérification')
    } finally {
      setLoading(false)
    }
  }

  // ✅ Fonction pour renvoyer le code
  const handleResendCode = async () => {
    if (cooldown > 0) {
      toast.error(`Veuillez attendre ${cooldown} secondes avant de renvoyer un code`)
      return
    }

    setResendLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        toast.error('Vous devez être connecté')
        return
      }

      const { data, error } = await supabase.functions.invoke('generate-temp-pin', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (error) {
        console.error('Erreur génération code:', error)
        if (error.context) {
          try {
            const cloned = error.context.clone ? error.context.clone() : error.context
            const text = await cloned.text()
            console.error('Body texte brut:', text)
          } catch (e) {
            console.error('Impossible de lire le body:', e)
          }
        }
        throw new Error(error.message || 'Erreur inconnue')
      }

      if (data?.error) throw new Error(JSON.stringify(data))

      toast.success('Un nouveau code a été envoyé par email')
      setCooldown(60) // 🔒 Cooldown de 60 secondes
    } catch (error: any) {
      console.error('Erreur envoi code:', error)
      toast.error(error?.message || 'Erreur lors de l\'envoi du code')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-zinc-900 flex flex-col items-center justify-center gap-8 p-6">
      <Card className="max-w-md w-full rounded-2xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <Mail className="h-5 w-5" />
            Code reçu par email
          </CardTitle>
          <p className="text-center text-sm text-gray-500 mt-2">
            Entrez le code à 6 chiffres envoyé à votre adresse email (valable 15 minutes).
          </p>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <PinPad length={6} onComplete={handleVerify} error={error} disabled={loading} />

          {/* ✅ Bouton Renvoyer le code */}
          <div className="mt-6 w-full flex flex-col items-center gap-3">
            <Button
              variant="outline"
              onClick={handleResendCode}
              disabled={resendLoading || cooldown > 0}
              className="w-full rounded-xl gap-2"
            >
              {resendLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : cooldown > 0 ? (
                <>
                  <Clock className="h-4 w-4" />
                  Attendre {cooldown}s
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Renvoyer le code
                </>
              )}
            </Button>

            {/* Message d'information sur la validité */}
            <p className="text-xs text-gray-400">
              Le code est valable 15 minutes. Vous pouvez demander un nouveau code après 60 secondes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}