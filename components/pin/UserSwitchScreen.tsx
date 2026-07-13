'use client'

/**
 * components/pin/UserSwitchScreen.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Cashier selector + PIN entry screen.
 *
 * Shown when:
 *  - The admin wants to hand the POS to a cashier.
 *  - A cashier wants to switch to their own profile.
 *  - A cashier logs out → admin can reconnect via PIN
 *
 * Flow:
 *  1. Display a dropdown (Select) of active cashiers.
 *  2. User selects their profile.
 *  3. User enters their 4-6 digit PIN.
 *     - 3 wrong attempts  → soft lock, 30s countdown, retry automatically.
 *     - 5 wrong attempts  → hard lock, 5min, a temp code is emailed to the
 *       admin. An inline step lets the admin type that code to clear the
 *       lock (does NOT change the cashier's PIN — they just retry it).
 *  4. Admin button in top-left → Admin PIN verification step
 *  5. Admin forgot PIN → receive email code → set new PIN (admin only)
 *  6. Cashier forgot PIN → "Contacter l'administrateur"
 */

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getActiveCashiers, verifyCashierPin, unlockCashierWithEmailCode,
  type AppUserRow,
} from '@/lib/user-data'
import { verifyAdminPin, setPinCode } from '@/lib/pin-storage'
import { sendPinResetNotification } from '@/lib/notifications-data'
import type { AppUser } from '@/context/UserContext'
import { ArrowLeft, Loader2, Mail, Lock, User, Shield, Key, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import Rive from '@rive-app/react-canvas'
import { supabase } from '@/src/lib/supabase'
import { usePin } from '@/components/pin/pin-context'

interface UserSwitchScreenProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (user: AppUser) => void
}

type Step = 
  | 'select' 
  | 'pin' 
  | 'admin-pin' 
  | 'locked' 
  | 'unlock-email' 
  | 'admin-reset-pin' 
  | 'admin-verify-code'
  | 'admin-set-new-pin'
  | 'cashier-forgot-pin'

const BLUE = '#38BDF8'

export default function UserSwitchScreen({ open, onOpenChange, onSuccess }: UserSwitchScreenProps) {
  const router = useRouter()
  const { pauseInactivity, resumeInactivity } = usePin()
  const [step, setStep] = useState<Step>('select')
  const [cashiers, setCashiers] = useState<AppUserRow[]>([])
  const [selected, setSelected] = useState<AppUserRow | null>(null)
  const [pin, setPin] = useState('')
  const [adminPin, setAdminPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [adminLoading, setAdminLoading] = useState(false)
  const [loadingCashiers, setLoadingCashiers] = useState(true)
  const [error, setError] = useState('')
  const [adminError, setAdminError] = useState('')
  const [adminAttempts, setAdminAttempts] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const adminInputRef = useRef<HTMLInputElement>(null)
  const [riveKey, setRiveKey] = useState(0)

  // Lockout state
  const [lockType, setLockType] = useState<'soft' | 'hard'>('soft')
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [emailSent, setEmailSent] = useState(false)

  // Email unlock step
  const [emailCode, setEmailCode] = useState('')
  const [unlockLoading, setUnlockLoading] = useState(false)
  const [unlockError, setUnlockError] = useState('')

  // Admin PIN state
  const [adminLocked, setAdminLocked] = useState(false)
  const [adminLockSeconds, setAdminLockSeconds] = useState(0)

  // Admin reset PIN state
  const [loadingReset, setLoadingReset] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState(false)

  // Admin verify temp code state
  const [tempCode, setTempCode] = useState('')
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [codeVerified, setCodeVerified] = useState(false)

  // Admin set new PIN state
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showNewPin, setShowNewPin] = useState(false)
  const [savingNewPin, setSavingNewPin] = useState(false)

  // ─── PAUSER L'INACTIVITÉ QUAND LE DIALOG EST OUVERT ───
  useEffect(() => {
    if (open) {
      pauseInactivity()
    }
    return () => {
      resumeInactivity()
    }
  }, [open])

  useEffect(() => {
    if (open) {
      setStep('select')
      setSelected(null)
      setPin('')
      setAdminPin('')
      setError('')
      setAdminError('')
      setAdminAttempts(0)
      setAdminLocked(false)
      setEmailCode('')
      setUnlockError('')
      setResetError(null)
      setResetSuccess(false)
      setNewPin('')
      setConfirmPin('')
      setTempCode('')
      setCodeError('')
      setCodeVerified(false)
      loadCashiers()
    }
  }, [open])

  useEffect(() => {
    if (step === 'pin') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    if (step === 'admin-pin') {
      setTimeout(() => adminInputRef.current?.focus(), 100)
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

  // Admin lock countdown
  useEffect(() => {
    if (!adminLocked || adminLockSeconds <= 0) return
    const interval = setInterval(() => {
      setAdminLockSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval)
          setAdminLocked(false)
          setAdminAttempts(0)
          setAdminPin('')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [adminLocked, adminLockSeconds])

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

  const handleSelectCashier = (cashierId: string) => {
    const cashier = cashiers.find(c => c.id === cashierId)
    if (cashier) {
      setSelected(cashier)
      setPin('')
      setError('')
      setStep('pin')
    }
  }

  const handlePinInput = (digit: string) => {
    if (pin.length >= 6) return
    setPin((p) => p + digit)
    setError('')
  }

  const handleAdminPinInput = (digit: string) => {
    if (adminPin.length >= 8) return
    setAdminPin((p) => p + digit)
    setAdminError('')
  }

  const handleDelete = () => {
    setPin((p) => p.slice(0, -1))
    setError('')
  }

  const handleAdminDelete = () => {
    setAdminPin((p) => p.slice(0, -1))
    setAdminError('')
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
          active: result.user.active,
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

  // ─── ADMIN PIN VERIFICATION ──────────────────────────────────────────
  const handleAdminVerify = async () => {
    if (adminPin.length < 4) return
    if (adminLocked) {
      setAdminError(`Trop de tentatives. Réessayez dans ${adminLockSeconds}s`)
      return
    }

    setAdminLoading(true)
    setAdminError('')

    try {
      const { data } = await supabase.auth.getSession()
      const supabaseUser = data.session?.user

      if (!supabaseUser) {
        setAdminError('Session admin introuvable. Veuillez vous reconnecter via la page de login.')
        return
      }

      const isValid = await verifyAdminPin(supabaseUser.id, adminPin)

      if (isValid) {
        const appUser: AppUser = {
          id: supabaseUser.id,
          name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'Admin',
          email: supabaseUser.email || null,
          phone: supabaseUser.user_metadata?.phone || null,
          avatarUrl: supabaseUser.user_metadata?.avatar_url || null,
          role: 'admin',
          permissions: [],
          supabaseUser: supabaseUser,
          active: true,
        }
        onSuccess(appUser)
        onOpenChange(false)
        return
      }

      const newAttempts = adminAttempts + 1
      setAdminAttempts(newAttempts)

      if (newAttempts >= 5) {
        setAdminLocked(true)
        setAdminLockSeconds(300)
        setAdminError(`Trop de tentatives. Réessayez dans 5 minutes.`)
        setAdminPin('')
        return
      }

      setAdminError(
        `PIN incorrect. ${5 - newAttempts} tentative(s) restante(s).`
      )
      setAdminPin('')
      adminInputRef.current?.focus()
    } catch (error) {
      console.error('Erreur vérification admin:', error)
      setAdminError('Erreur lors de la vérification du PIN admin.')
    } finally {
      setAdminLoading(false)
    }
  }

  // ─── ADMIN RESET PIN - Envoyer le code par email ─────────────────────
  const handleAdminResetPin = async () => {
    setLoadingReset(true)
    setResetError(null)
    setResetSuccess(false)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        setResetError(`Erreur session: ${sessionError.message}`)
        toast.error('Erreur de session')
        return
      }

      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        setResetError('Vous devez être connecté')
        toast.error('Vous devez être connecté')
        return
      }

      const { data, error } = await supabase.functions.invoke('generate-temp-pin', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (error) {
        let errorDetail = error.message
        if (error.context) {
          try {
            const text = await error.context.text()
            try {
              const json = JSON.parse(text)
              errorDetail = json.detail || json.error || text
            } catch {
              errorDetail = text
            }
          } catch {
            // ignore
          }
        }
        setResetError(`Erreur: ${errorDetail}`)
        toast.error(`Erreur: ${errorDetail}`)
        return
      }

      if (data?.error) {
        setResetError(data.error)
        toast.error(data.error)
        return
      }

      setResetSuccess(true)
      toast.success('Un code temporaire a été envoyé par email')
      
      setTimeout(() => {
        setStep('admin-verify-code')
        setTempCode('')
        setCodeError('')
        setCodeVerified(false)
        setResetSuccess(false)
      }, 1500)

    } catch (error: any) {
      console.error('Erreur envoi code:', error)
      setResetError(error?.message || 'Erreur lors de l\'envoi de l\'email')
      toast.error(error?.message || 'Erreur lors de l\'envoi de l\'email')
    } finally {
      setLoadingReset(false)
    }
  }

  // ─── ADMIN VERIFY TEMP CODE ──────────────────────────────────────────
  const handleVerifyTempCode = async () => {
    if (tempCode.length < 4) {
      setCodeError('Le code doit contenir au moins 4 chiffres')
      return
    }

    setVerifyingCode(true)
    setCodeError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        setCodeError('Session expirée, veuillez réessayer')
        return
      }

      // ✅ CORRECTIF : body en objet (pas de JSON.stringify — invoke() sérialise
      // lui-même), et clé "pin" (pas "code") pour matcher ce qu'attend la
      // edge function verify-temp-pin: const { pin } = await req.json()
      const { data, error } = await supabase.functions.invoke('verify-temp-pin', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: { pin: tempCode },
      })

      if (error) {
        let errorDetail = error.message
        if (error.context) {
          try {
            const text = await error.context.text()
            try {
              const json = JSON.parse(text)
              errorDetail = json.detail || json.error || text
            } catch {
              errorDetail = text
            }
          } catch {
            // ignore
          }
        }
        setCodeError(errorDetail)
        return
      }

      if (data?.error) {
        setCodeError(data.error)
        return
      }

      if (data?.valid) {
        setCodeVerified(true)
        toast.success('Code vérifié !')
        setTimeout(() => {
          setStep('admin-set-new-pin')
          setNewPin('')
          setConfirmPin('')
        }, 1000)
      } else {
        setCodeError('Code invalide ou expiré')
      }
    } catch (error: any) {
      console.error('Erreur vérification code:', error)
      setCodeError(error?.message || 'Erreur lors de la vérification')
    } finally {
      setVerifyingCode(false)
    }
  }

  // ─── ADMIN SET NEW PIN ───────────────────────────────────────────────
  const handleSetNewPin = async () => {
    if (!/^\d{4,6}$/.test(newPin)) {
      toast.error('Le PIN doit contenir entre 4 et 6 chiffres')
      return
    }
    if (newPin !== confirmPin) {
      toast.error('Les deux codes ne correspondent pas')
      return
    }

    setSavingNewPin(true)
    try {
      await setPinCode(newPin)
      toast.success('Votre nouveau PIN a été défini avec succès')
      
      setTimeout(() => {
        supabase.auth.getSession().then(({ data }) => {
          const supabaseUser = data.session?.user
          if (supabaseUser) {
            const appUser: AppUser = {
              id: supabaseUser.id,
              name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'Admin',
              email: supabaseUser.email || null,
              phone: supabaseUser.user_metadata?.phone || null,
              avatarUrl: supabaseUser.user_metadata?.avatar_url || null,
              role: 'admin',
              permissions: [],
              supabaseUser: supabaseUser,
              active: true,
            }
            onSuccess(appUser)
            onOpenChange(false)
          } else {
            setStep('select')
          }
        })
      }, 1000)
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la mise à jour du PIN')
    } finally {
      setSavingNewPin(false)
    }
  }

  // ─── CASHIER FORGOT PIN ──────────────────────────────────────────────
  const handleCashierForgotPin = async () => {
    if (!selected) return
    
    try {
      await sendPinResetNotification(selected.id, selected.name)
      toast.success('Notification envoyée à l\'administrateur')
    } catch (error) {
      console.error('Erreur envoi notification:', error)
      toast.error('Erreur lors de l\'envoi de la notification')
    }
    
    setStep('cashier-forgot-pin')
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

  const handleAdminMode = () => {
    setStep('admin-pin')
    setAdminPin('')
    setAdminError('')
    setAdminAttempts(0)
    setAdminLocked(false)
  }

  const initials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`
  }

  const handleRiveError = () => setRiveKey((k) => k + 1)

  // ─── Empêcher la fermeture accidentelle du Dialog sur les étapes
  // sensibles (saisie d'un code reçu / définition d'un nouveau PIN).
  // X, clic en dehors et Échap redirigent vers la sélection au lieu
  // de fermer et révéler le dashboard en dessous. ───
  const PROTECTED_STEPS: Step[] = ['admin-verify-code', 'admin-set-new-pin', 'unlock-email']

  const handleDialogOpenChange = (newOpen: boolean) => {
    if (!newOpen && PROTECTED_STEPS.includes(step)) {
      setStep('select')
      setTempCode('')
      setCodeError('')
      setCodeVerified(false)
      setNewPin('')
      setConfirmPin('')
      setEmailCode('')
      setUnlockError('')
      return
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">

        {/* ─── Bouton Admin en haut à gauche ──────────────────────────── */}
        {step === 'select' && (
          <div className="absolute top-4 left-4 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAdminMode}
              className="flex items-center gap-1.5 rounded-lg border-gray-200 dark:border-zinc-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors text-sm"
            >
              <Shield className="w-4 h-4 text-blue-500" />
              Admin
            </Button>
          </div>
        )}

        {/* ─── Animation Rive ───────────────────────────────────── */}
        <div className="w-48 h-48 mx-auto -mb-4 -mt-2">
          <Rive
            key={riveKey}
            src="/animations/pin-animation.riv"
            onError={handleRiveError}
          />
        </div>

        {/* ─── Étape 1 : sélection du profil ──────────────────────────── */}
        {step === 'select' && (
          <>
            <DialogHeader className="px-6 pt-2 pb-4">
              <DialogTitle className="text-lg font-bold text-center">Qui êtes-vous ?</DialogTitle>
              <DialogDescription className="text-sm text-gray-500 text-center">
                Sélectionnez votre profil pour continuer.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6">
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
                <Select onValueChange={handleSelectCashier}>
                  <SelectTrigger className="rounded-xl h-12 px-4 border-gray-200 dark:border-zinc-700">
                    <SelectValue placeholder="Choisissez votre profil" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {cashiers.map((cashier) => (
                      <SelectItem key={cashier.id} value={cashier.id} className="py-2.5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-7 w-7 shrink-0">
                            {cashier.avatarUrl && <AvatarImage src={cashier.avatarUrl} />}
                            <AvatarFallback
                              className="text-xs font-bold text-white"
                              style={{ background: 'linear-gradient(135deg, #38BDF8, #0EA5E9)' }}
                            >
                              {initials(cashier.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{cashier.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </>
        )}

        {/* ─── Étape Admin PIN ─────────────────────────────────────────── */}
        {step === 'admin-pin' && (
          <>
            <DialogHeader className="px-6 pt-2 pb-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <button
                  onClick={() => { setStep('select'); setAdminPin(''); setAdminError('') }}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </button>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-500" />
                  Administrateur
                </DialogTitle>
                <div className="w-8" />
              </div>
              <DialogDescription className="text-sm text-gray-500 text-center">
                Entrez votre code PIN administrateur
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6">
              <div className="flex justify-center gap-3 my-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-3.5 h-3.5 rounded-full border-2 transition-all duration-150"
                    style={{
                      backgroundColor: i < adminPin.length ? BLUE : 'transparent',
                      borderColor: i < adminPin.length ? BLUE : '#D1D5DB',
                    }}
                  />
                ))}
              </div>

              {adminError && (
                <p className="text-center text-sm text-red-500 mb-4">{adminError}</p>
              )}

              <input
                ref={adminInputRef}
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={adminPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '')
                  setAdminPin(val)
                  setAdminError('')
                }}
                className="sr-only"
                aria-label="Admin PIN code"
                disabled={adminLocked}
              />

              <div className="grid grid-cols-3 gap-2">
                {['1','2','3','4','5','6','7','8','9'].map((d) => (
                  <button
                    key={d}
                    onClick={() => handleAdminPinInput(d)}
                    disabled={adminLocked}
                    className={`h-14 rounded-xl text-xl font-semibold bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors ${
                      adminLocked ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {d}
                  </button>
                ))}
                <button
                  onClick={handleAdminDelete}
                  disabled={adminLocked}
                  className={`h-14 rounded-xl text-sm font-medium text-gray-500 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors ${
                    adminLocked ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  ⌫
                </button>
                <button
                  onClick={() => handleAdminPinInput('0')}
                  disabled={adminLocked}
                  className={`h-14 rounded-xl text-xl font-semibold bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors ${
                    adminLocked ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  0
                </button>
                <Button
                  onClick={handleAdminVerify}
                  disabled={adminPin.length < 4 || adminLoading || adminLocked}
                  className="h-14 rounded-xl text-white font-semibold"
                  style={{ backgroundColor: BLUE }}
                >
                  {adminLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'OK'}
                </Button>
              </div>

              {/* ─── ADMIN: PIN oublié ────────────────────────────────── */}
              <button
                onClick={handleAdminResetPin}
                disabled={loadingReset}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mt-4 underline flex items-center justify-center gap-1"
              >
                <Mail className="h-3 w-3" />
                {loadingReset ? 'Envoi en cours...' : 'PIN oublié ? Réinitialiser par email'}
              </button>
            </div>
          </>
        )}

        {/* ─── Étape : Admin - Envoi du code en cours ─────────────────── */}
        {step === 'admin-reset-pin' && (
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-500" />
                Envoi du code...
              </DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6 flex flex-col items-center gap-4">
              {resetSuccess ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-center text-sm text-gray-600">
                    Un code temporaire a été envoyé par email.
                  </p>
                  <p className="text-center text-xs text-gray-400">
                    Vous allez être redirigé pour entrer le code...
                  </p>
                </>
              ) : resetError ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  </div>
                  <p className="text-center text-sm text-red-600">{resetError}</p>
                  <Button
                    variant="outline"
                    onClick={() => setStep('admin-pin')}
                    className="rounded-xl"
                  >
                    Retour
                  </Button>
                </>
              ) : (
                <>
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-center text-sm text-gray-600">
                    Envoi du code en cours...
                  </p>
                </>
              )}
            </div>
          </>
        )}

        {/* ─── Étape : Admin - Vérifier le code temporaire ────────────── */}
        {step === 'admin-verify-code' && (
          <>
            <DialogHeader className="px-6 pt-2 pb-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <button
                  onClick={() => { setStep('admin-pin'); setTempCode(''); setCodeError('') }}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </button>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-500" />
                  Code de vérification
                </DialogTitle>
                <div className="w-8" />
              </div>
              <DialogDescription className="text-sm text-gray-500 text-center">
                Entrez le code à 6 chiffres reçu par email
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6 space-y-4">
              <div className="flex justify-center gap-2 my-4">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={tempCode}
                  onChange={(e) => {
                    setTempCode(e.target.value.replace(/\D/g, ''))
                    setCodeError('')
                  }}
                  placeholder="123456"
                  className="rounded-xl text-center text-2xl tracking-[0.5em] h-14"
                  autoFocus
                  disabled={codeVerified}
                />
              </div>

              {codeError && (
                <p className="text-center text-sm text-red-500">{codeError}</p>
              )}

              {codeVerified ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-sm text-green-600 font-medium">Code vérifié !</p>
                  <p className="text-xs text-gray-400">Redirection en cours...</p>
                </div>
              ) : (
                <Button
                  onClick={handleVerifyTempCode}
                  disabled={tempCode.length < 4 || verifyingCode}
                  className="w-full rounded-xl text-white h-12 font-semibold"
                  style={{ backgroundColor: BLUE }}
                >
                  {verifyingCode ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Vérifier le code'
                  )}
                </Button>
              )}

              <button
                onClick={handleAdminResetPin}
                disabled={loadingReset}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 underline"
              >
                {loadingReset ? 'Envoi en cours...' : 'Renvoyer le code'}
              </button>
            </div>
          </>
        )}

        {/* ─── Étape : Admin - Définir nouveau PIN ────────────────────── */}
        {step === 'admin-set-new-pin' && (
          <>
            <DialogHeader className="px-6 pt-2 pb-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <button
                  onClick={() => { setStep('admin-verify-code'); setNewPin(''); setConfirmPin('') }}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </button>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <Key className="w-5 h-5 text-blue-500" />
                  Nouveau PIN
                </DialogTitle>
                <div className="w-8" />
              </div>
              <DialogDescription className="text-sm text-gray-500 text-center">
                Définissez votre nouveau code PIN (4 à 6 chiffres)
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nouveau PIN
                </Label>
                <div className="relative">
                  <Input
                    type={showNewPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="rounded-xl h-11 tracking-widest pr-10"
                    placeholder="Entrez votre nouveau PIN"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPin((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirmer le PIN
                </Label>
                <Input
                  type={showNewPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="rounded-xl h-11 tracking-widest"
                  placeholder="Confirmez votre nouveau PIN"
                />
              </div>

              <Button
                onClick={handleSetNewPin}
                disabled={savingNewPin || newPin.length < 4 || newPin !== confirmPin}
                className="w-full rounded-xl text-white h-11 font-semibold"
                style={{ backgroundColor: BLUE }}
              >
                {savingNewPin ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Définir le nouveau PIN'
                )}
              </Button>

              <p className="text-xs text-gray-400 text-center">
                Une fois défini, vous serez redirigé vers le tableau de bord.
              </p>
            </div>
          </>
        )}

        {/* ─── Étape 2 : pavé PIN caissier ─────────────────────────────── */}
        {step === 'pin' && selected && (
          <>
            <DialogHeader className="px-6 pt-2 pb-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <button
                  onClick={() => { setStep('select'); setPin(''); setError('') }}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </button>
                <DialogTitle className="text-lg font-bold">
                  Bonjour, {selected.name.split(' ')[0]} !
                </DialogTitle>
                <div className="w-8" />
              </div>
              <DialogDescription className="text-sm text-gray-500 text-center">
                Entrez votre code PIN
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-2">
              <div className="flex items-center gap-3 px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50">
                <Avatar className="h-8 w-8 shrink-0">
                  {selected.avatarUrl && <AvatarImage src={selected.avatarUrl} />}
                  <AvatarFallback
                    className="text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #38BDF8, #0EA5E9)' }}
                  >
                    {initials(selected.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm text-gray-700 dark:text-gray-300 flex-1">
                  {selected.name}
                </span>
                <User className="w-4 h-4 text-gray-400" />
              </div>
            </div>

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

              {/* ─── CAISSIER: PIN oublié ─────────────────────────────── */}
              <button
                onClick={handleCashierForgotPin}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4 underline flex items-center justify-center gap-1"
              >
                <AlertCircle className="h-3 w-3" />
                PIN oublié ? Contacter l'administrateur
              </button>
            </div>
          </>
        )}

        {/* ─── Étape : Caissier - PIN oublié ───────────────────────────── */}
        {step === 'cashier-forgot-pin' && selected && (
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => { setStep('pin'); setPin(''); setError('') }}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </button>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  PIN oublié
                </DialogTitle>
              </div>
            </DialogHeader>

            <div className="px-6 pb-6 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <User className="w-8 h-8 text-amber-600" />
              </div>
              
              <div className="flex items-center gap-2">
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

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 w-full">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Une notification a été envoyée à l'administrateur.
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  L'administrateur pourra réinitialiser votre code PIN depuis la page de gestion des utilisateurs.
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => { setStep('pin'); setPin(''); setError('') }}
                className="rounded-xl w-full"
              >
                Retour
              </Button>
            </div>
          </>
        )}

        {/* ─── Étape 3 : compte bloqué ───────────────────────────────── */}
        {step === 'locked' && selected && (
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Lock className="w-5 h-5 text-red-500" />
                Compte temporairement bloqué
              </DialogTitle>
            </DialogHeader>

            <div className="px-6 pb-6 flex flex-col items-center text-center gap-3">
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

        {/* ─── Étape 4 : déblocage via code email ─────────────────────── */}
        {step === 'unlock-email' && selected && (
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