'use client'

/**
 * components/pin/UserSwitchScreen.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Cashier selector + PIN entry screen.
 *
 * Shown when:
 *  - The admin wants to hand the POS to a cashier.
 *  - A cashier wants to switch to their own profile.
 *
 * Flow:
 *  1. Display list of active cashiers.
 *  2. User selects their profile.
 *  3. User enters their 4-6 digit PIN.
 *     - 3 wrong attempts  → soft lock, 30s countdown, retry automatically.
 *     - 5 wrong attempts  → hard lock, 5min, a temp code is emailed to the
 *       admin. An inline step lets the admin type that code to clear the
 *       lock (does NOT change the cashier's PIN — they just retry it).
 *  4. On success → calls onSuccess(appUser).
 */

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getActiveCashiers, verifyCashierPin, unlockCashierWithEmailCode,
  type AppUserRow,
} from '@/lib/user-data'
import type { AppUser } from '@/context/UserContext'
import { ArrowLeft, Loader2, Mail, Lock } from 'lucide-react'
import { toast } from 'sonner'

interface UserSwitchScreenProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (user: AppUser) => void
}

type Step = 'select' | 'pin' | 'locked' | 'unlock-email'

const BLUE = '#38BDF8'

export function UserSwitchScreen({ open, onOpenChange, onSuccess }: UserSwitchScreenProps) {
  const [step, setStep] = useState<Step>('select')
  const [cashiers, setCashiers] = useState<AppUserRow[]>([])
  const [selected, setSelected] = useState<AppUserRow | null>(null)
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingCashiers, setLoadingCashiers] = useState(true)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Lockout state
  const [lockType, setLockType] = useState<'soft' | 'hard'>('soft')
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [emailSent, setEmailSent] = useState(false)

  // Email unlock step
  const [emailCode, setEmailCode] = useState('')
  const [unlockLoading, setUnlockLoading] = useState(false)
  const [unlockError, setUnlockError] = useState('')

  useEffect(() => {
    if (open) {
      setStep('select')
      setSelected(null)
      setPin('')
      setError('')
      setEmailCode('')
      setUnlockError('')
      loadCashiers()
    }
  }, [open])

  useEffect(() => {
    if (step === 'pin') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [step])

  // Countdown while locked
  useEffect(() => {
    if (step !== 'locked' || remainingSeconds <= 0) return
    const interval = setInterval(() => {
      setRemainingSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval)
          setStep('pin')
          setPin('')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [step, remainingSeconds])

  const loadCashiers = async () => {
    setLoadingCashiers(true)
    try {
      const list = await getActiveCashiers()
      setCashiers(list)
    } catch {
      toast.error('Impossible de charger les utilisateurs')
    } finally {
      setLoadingCashiers(false)
    }
  }

  const handleSelectCashier = (cashier: AppUserRow) => {
    setSelected(cashier)
    setPin('')
    setError('')
    setStep('pin')
  }

  const handlePinInput = (digit: string) => {
    if (pin.length >= 6) return
    setPin((p) => p + digit)
    setError('')
  }

  const handleDelete = () => {
    setPin((p) => p.slice(0, -1))
    setError('')
  }

  const handleVerify = async () => {
    if (!selected || pin.length < 4) return
    setLoading(true)
    setError('')
    try {
      const result = await verifyCashierPin(selected.id, pin)

      if (result.status === 'success') {
        const appUser: AppUser = {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          phone: result.user.phone,
          avatarUrl: result.user.avatarUrl,
          role: result.user.role,
          permissions: result.user.permissions,
        }
        onSuccess(appUser)
        onOpenChange(false)
        return
      }

      if (result.status === 'locked') {
        setLockType(result.type)
        setRemainingSeconds(result.remainingSeconds)
        setEmailSent(!!result.emailSent)
        setStep('locked')
        setPin('')
        return
      }

      // invalid
      setError(
        result.remainingAttempts > 0
          ? `Code PIN incorrect. ${result.remainingAttempts} tentative(s) avant blocage.`
          : 'Code PIN incorrect. Réessayez.'
      )
      setPin('')
      inputRef.current?.focus()
    } catch {
      setError('Erreur lors de la vérification.')
    } finally {
      setLoading(false)
    }
  }

  const handleUnlockWithEmailCode = async () => {
    if (!selected || emailCode.length < 4) return
    setUnlockLoading(true)
    setUnlockError('')
    try {
      const result = await unlockCashierWithEmailCode(selected.id, emailCode)
      if (result.success) {
        toast.success('Compte débloqué')
        setEmailCode('')
        setStep('pin')
        setPin('')
      } else {
        setUnlockError(result.error || 'Code incorrect')
      }
    } catch {
      setUnlockError('Erreur lors de la vérification')
    } finally {
      setUnlockLoading(false)
    }
  }

  const initials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-2xl p-0 overflow-hidden">

        {/* ─── Étape 1 : sélection du profil ─────────────────────────── */}
        {step === 'select' && (
          <>
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-bold">Changer d'utilisateur</DialogTitle>
              <DialogDescription className="text-sm text-gray-500">
                Sélectionnez votre profil pour continuer.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6 space-y-2 max-h-80 overflow-y-auto">
              {loadingCashiers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : cashiers.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">
                  Aucun caissier actif trouvé.<br />
                  L'administrateur doit d'abord créer des profils caissiers.
                </p>
              ) : (
                cashiers.map((cashier) => (
                  <button
                    key={cashier.id}
                    onClick={() => handleSelectCashier(cashier)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left border border-transparent hover:border-gray-100 dark:hover:border-zinc-700"
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      {cashier.avatarUrl && <AvatarImage src={cashier.avatarUrl} />}
                      <AvatarFallback
                        className="text-sm font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #38BDF8, #0EA5E9)' }}
                      >
                        {initials(cashier.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">
                        {cashier.name}
                      </p>
                      {cashier.phone && (
                        <p className="text-xs text-gray-400 truncate">{cashier.phone}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {/* ─── Étape 2 : pavé PIN ─────────────────────────────────────── */}
        {step === 'pin' && (
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => { setStep('select'); setPin(''); setError('') }}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </button>
                <DialogTitle className="text-lg font-bold">Entrez votre PIN</DialogTitle>
              </div>
              {selected && (
                <div className="flex items-center gap-2 mt-2">
                  <Avatar className="h-8 w-8 shrink-0">
                    {selected.avatarUrl && <AvatarImage src={selected.avatarUrl} />}
                    <AvatarFallback
                      className="text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #38BDF8, #0EA5E9)' }}
                    >
                      {initials(selected.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-sm">{selected.name}</span>
                </div>
              )}
            </DialogHeader>

            <div className="px-6 pb-6">
              <div className="flex justify-center gap-3 my-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-full border-2 transition-all duration-150"
                    style={{
                      backgroundColor: i < pin.length ? BLUE : 'transparent',
                      borderColor: i < pin.length ? BLUE : '#D1D5DB',
                    }}
                  />
                ))}
              </div>

              {error && (
                <p className="text-center text-sm text-red-500 mb-4">{error}</p>
              )}

              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '')
                  setPin(val)
                  setError('')
                }}
                className="sr-only"
                aria-label="PIN code"
              />

              <div className="grid grid-cols-3 gap-2">
                {['1','2','3','4','5','6','7','8','9'].map((d) => (
                  <button
                    key={d}
                    onClick={() => handlePinInput(d)}
                    className="h-14 rounded-xl text-xl font-semibold bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {d}
                  </button>
                ))}
                <button
                  onClick={handleDelete}
                  className="h-14 rounded-xl text-sm font-medium text-gray-500 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  ⌫
                </button>
                <button
                  onClick={() => handlePinInput('0')}
                  className="h-14 rounded-xl text-xl font-semibold bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  0
                </button>
                <Button
                  onClick={handleVerify}
                  disabled={pin.length < 4 || loading}
                  className="h-14 rounded-xl text-white font-semibold"
                  style={{ backgroundColor: BLUE }}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'OK'}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ─── Étape 3 : compte bloqué (soft ou hard lock) ───────────── */}
        {step === 'locked' && (
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Lock className="w-5 h-5 text-red-500" />
                Compte temporairement bloqué
              </DialogTitle>
            </DialogHeader>

            <div className="px-6 pb-6 flex flex-col items-center text-center gap-3">
              {selected && (
                <div className="flex items-center gap-2 mb-1">
                  <Avatar className="h-8 w-8 shrink-0">
                    {selected.avatarUrl && <AvatarImage src={selected.avatarUrl} />}
                    <AvatarFallback
                      className="text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #38BDF8, #0EA5E9)' }}
                    >
                      {initials(selected.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-sm">{selected.name}</span>
                </div>
              )}

              <p className="text-sm text-gray-500">
                Trop de tentatives incorrectes. Réessayez dans{' '}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {formatTime(remainingSeconds)}
                </span>.
              </p>

              {lockType === 'hard' && (
                <>
                  <div className="w-full h-px bg-gray-100 dark:bg-zinc-800 my-2" />
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Mail className="w-4 h-4 shrink-0" />
                    {emailSent
                      ? "Un code de déblocage a été envoyé à l'administrateur."
                      : "L'envoi de l'email a échoué — patientez ou réessayez plus tard."}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setStep('unlock-email')}
                    className="rounded-xl mt-1"
                  >
                    J'ai reçu le code
                  </Button>
                </>
              )}

              <button
                onClick={() => { setStep('select'); setSelected(null) }}
                className="text-xs text-gray-400 hover:text-gray-600 mt-2"
              >
                Choisir un autre profil
              </button>
            </div>
          </>
        )}

        {/* ─── Étape 4 : déblocage via code reçu par email ───────────── */}
        {step === 'unlock-email' && (
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => { setStep('locked'); setEmailCode(''); setUnlockError('') }}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </button>
                <DialogTitle className="text-lg font-bold">Code de déblocage</DialogTitle>
              </div>
              <DialogDescription className="text-sm text-gray-500">
                Entrez le code à 6 chiffres reçu par email par l'administrateur.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6 space-y-4">
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={emailCode}
                onChange={(e) => {
                  setEmailCode(e.target.value.replace(/\D/g, ''))
                  setUnlockError('')
                }}
                placeholder="123456"
                className="rounded-xl text-center text-lg tracking-widest"
                autoFocus
              />

              {unlockError && (
                <p className="text-center text-sm text-red-500">{unlockError}</p>
              )}

              <Button
                onClick={handleUnlockWithEmailCode}
                disabled={emailCode.length < 4 || unlockLoading}
                className="w-full rounded-xl text-white font-semibold"
                style={{ backgroundColor: BLUE }}
              >
                {unlockLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Débloquer le compte'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}