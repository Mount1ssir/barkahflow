'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Fingerprint, Mail } from 'lucide-react'
import { PinPad } from '@/components/pin/PinPad'
import {
  verifyPinCode,
  getRemainingAttempts,
  isLockedOut,
  getLockoutRemainingSeconds,
  isPinEnabled,
  isBiometricEnabled,
  getRememberedUser,
  setRememberedUser,
} from '@/lib/pin-storage'
import { authenticateWithBiometric } from '@/lib/biometric-auth'
import { toast } from 'sonner'
import Rive from '@rive-app/react-canvas'
import { supabase } from '@/src/lib/supabase'

interface PinLockScreenProps {
  onSuccess: () => void
}

export function PinLockScreen({ onSuccess }: PinLockScreenProps) {
  const router = useRouter()
  const [error, setError] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [riveKey, setRiveKey] = useState(0)
  const [userName, setUserName] = useState('Utilisateur')
  const [loadingReset, setLoadingReset] = useState(false)

  useEffect(() => {
    const remembered = getRememberedUser()
    if (remembered) {
      setUserName(remembered.name)
    } else {
      supabase.auth.getUser().then(({ data }) => {
        const user = data.user
        if (user) {
          const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Utilisateur'
          const firstName = fullName.split(' ')[0]
          setUserName(firstName)
          setRememberedUser(firstName, '')
        }
      })
    }

    if (!isPinEnabled()) {
      onSuccess()
      return
    }

    const checkBiometric = async () => {
      const available = await import('@/lib/biometric-auth').then(m => m.isBiometricAvailable())
      setBiometricAvailable(available)
      if (available && isBiometricEnabled()) {
        const result = await authenticateWithBiometric()
        if (result.success) {
          onSuccess()
          return
        } else if (result.error) {
          toast.error(result.error)
        }
      }
    }
    checkBiometric()
    updateLockState()
  }, [])

  const updateLockState = () => {
    const remainingAttempts = getRemainingAttempts()
    setAttempts(remainingAttempts)
    const lockedStatus = isLockedOut()
    setLocked(lockedStatus)
    if (lockedStatus) {
      const seconds = getLockoutRemainingSeconds()
      setRemainingSeconds(seconds)
    }
  }

  const handlePinComplete = async (pin: string) => {
    if (locked) return

    const isValid = await verifyPinCode(pin)
    if (isValid) {
      if (!getRememberedUser()) {
        setRememberedUser(userName, '')
      }
      toast.success('PIN correct')
      setTimeout(() => onSuccess(), 400)
    } else {
      setError(true)
      const remaining = getRemainingAttempts()
      setAttempts(remaining)
      const lockedStatus = isLockedOut()
      if (lockedStatus) {
        const seconds = getLockoutRemainingSeconds()
        setRemainingSeconds(seconds)
        setLocked(true)
        const totalAttempts = 5 - remaining
        if (totalAttempts >= 5) {
          toast.error('Trop de tentatives, veuillez patienter 5 minutes')
        } else if (totalAttempts >= 3) {
          toast.error('Trop de tentatives, veuillez patienter 30 secondes')
        } else {
          toast.error(`PIN incorrect, il vous reste ${remaining} tentative(s)`)
        }
      } else {
        toast.error(`PIN incorrect, il vous reste ${remaining} tentative(s)`)
        setTimeout(() => setError(false), 500)
      }
    }
  }

  useEffect(() => {
    if (!locked) return
    if (remainingSeconds <= 0) {
      setLocked(false)
      updateLockState()
      return
    }
    const interval = setInterval(() => {
      setRemainingSeconds(prev => prev - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [locked, remainingSeconds])

  const handleBiometric = async () => {
    const result = await authenticateWithBiometric()
    if (result.success) {
      toast.success('Biométrie validée')
      onSuccess()
    } else {
      toast.error(result.error || 'Échec de la vérification biométrique')
    }
  }

  const handleRiveError = () => {
    setRiveKey(prev => prev + 1)
  }

  // ✅ Envoi du Magic Link (OTP) par email
  const handleResetPin = async () => {
    setLoadingReset(true)
    try {
      // Récupérer l'email de l'utilisateur connecté
      const { data } = await supabase.auth.getUser()
      const email = data.user?.email

      if (!email) {
        toast.error('Email introuvable. Veuillez vous reconnecter.')
        setLoadingReset(false)
        return
      }

      // ✅ Envoyer un Magic Link (OTP) via Supabase
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/reset-pin-confirm`,
        },
      })

      if (error) throw error

      toast.success('Lien de réinitialisation envoyé !')
      router.push('/auth/reset-pin-sent')
    } catch (error: any) {
      console.error('Erreur envoi email:', error)
      toast.error(error?.message || 'Erreur lors de l\'envoi de l\'email')
    } finally {
      setLoadingReset(false)
    }
  }

  const lockMessage = locked
    ? attempts >= 5
      ? `Compte bloqué pour ${Math.ceil(remainingSeconds)} secondes`
      : `Trop de tentatives, patientez ${Math.ceil(remainingSeconds)} secondes`
    : ''

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-900 flex flex-col items-center justify-center gap-8 p-6">
      <div className="w-72 h-72">
        <Rive
          key={riveKey}
          src="/animations/pin-animation.riv"
          onError={handleRiveError}
        />
      </div>

      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Bonjour, {userName} !
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {locked
            ? lockMessage
            : `Entrez votre code PIN (${attempts} tentatives restantes)`}
        </p>
      </div>

      {!locked && (
        <PinPad
          length={4}
          onComplete={handlePinComplete}
          error={error}
          disabled={locked}
        />
      )}

      {biometricAvailable && !locked && isBiometricEnabled() && (
        <button
          onClick={handleBiometric}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <Fingerprint size={20} />
          Utiliser la biométrie
        </button>
      )}

      {locked && (
        <div className="text-center">
          <p className="text-sm text-red-500">{lockMessage}</p>
          <button
            onClick={updateLockState}
            className="mt-2 text-sm text-blue-500 hover:underline"
          >
            Réessayer
          </button>
        </div>
      )}

      <button
        onClick={handleResetPin}
        disabled={loadingReset}
        className="mt-4 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors underline flex items-center gap-1"
      >
        <Mail className="h-3 w-3" />
        {loadingReset ? 'Envoi en cours...' : 'PIN oublié ? Réinitialiser par email'}
      </button>
    </div>
  )
}