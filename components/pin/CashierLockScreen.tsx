'use client'

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, Mail, X } from 'lucide-react'
import { toast } from 'sonner'
import Rive from '@rive-app/react-canvas'
import {
  getActiveCashiers,
  verifyCashierPin,
  requestCashierPinResetEmail,
  verifyCashierResetCode,
  updateCashier,
  type AppUserRow,
} from '@/lib/user-data'
import type { AppUser } from '@/context/UserContext'

interface CashierLockScreenProps {
  onSuccess: (user: AppUser) => void
  onCancel?: () => void
  preselectedCashier?: AppUserRow | null
}

type Overlay = 'none' | 'locked' | 'forgot-code' | 'forgot-newpin'

export function CashierLockScreen({ onSuccess, onCancel, preselectedCashier }: CashierLockScreenProps) {
  const [cashiers, setCashiers] = useState<AppUserRow[]>([])
  const [loadingCashiers, setLoadingCashiers] = useState(true)
  const [selected, setSelected] = useState<AppUserRow | null>(preselectedCashier || null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [riveKey] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [overlay, setOverlay] = useState<Overlay>('none')

  const [sendingReset, setSendingReset] = useState(false)
  const [resetCode, setResetCode] = useState('')
  const [resetError, setResetError] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmNewPin, setConfirmNewPin] = useState('')

  useEffect(() => {
    if (!preselectedCashier) {
      loadCashiers()
    } else {
      setLoadingCashiers(false)
    }
  }, [preselectedCashier])

  useEffect(() => {
    if (overlay !== 'locked' || remainingSeconds <= 0) return
    const interval = setInterval(() => {
      setRemainingSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval)
          setOverlay('none')
          setPin('')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [overlay, remainingSeconds])

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
  }

  const handleDeselect = () => {
    setSelected(null)
    setPin('')
    setError('')
  }

  const handleDigit = (digit: string) => {
    if (loading || pin.length >= 6) return
    setPin((p) => p + digit)
    setError('')
  }

  const handleDelete = () => {
    if (loading) return
    setPin((p) => p.slice(0, -1))
    setError('')
  }

  const handleVerify = async (fullPin: string) => {
    if (!selected) return
    setLoading(true)
    setError('')
    try {
      const result = await verifyCashierPin(selected.id, fullPin)

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
        toast.success('PIN correct')
        setTimeout(() => onSuccess(appUser), 300)
        return
      }

      if (result.status === 'locked') {
        setRemainingSeconds(result.remainingSeconds)
        setOverlay('locked')
        setPin('')
        return
      }

      setError(
        result.remainingAttempts > 0
          ? `Code incorrect. ${result.remainingAttempts} tentative(s) restante(s).`
          : 'Code PIN incorrect.'
      )
      setPin('')
    } catch {
      setError('Erreur lors de la vérification.')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (pin.length >= 4 && !loading && overlay === 'none' && selected) {
      const timeout = setTimeout(() => handleVerify(pin), 150)
      return () => clearTimeout(timeout)
    }
  }, [pin])

  const handleForgotPin = async () => {
    setSendingReset(true)
    try {
      const sent = await requestCashierPinResetEmail()
      if (sent) {
        toast.success("Un code a été envoyé à l'administrateur")
        setOverlay('forgot-code')
      } else {
        toast.error("Échec de l'envoi de l'email")
      }
    } catch {
      toast.error('Erreur lors de la demande')
    } finally {
      setSendingReset(false)
    }
  }

  const handleVerifyResetCode = async () => {
    setResetError('')
    setLoading(true)
    try {
      const result = await verifyCashierResetCode(resetCode)
      if (result.success) {
        setOverlay('forgot-newpin')
      } else {
        setResetError(result.error || 'Code incorrect')
      }
    } catch {
      setResetError('Erreur lors de la vérification')
    } finally {
      setLoading(false)
    }
  }

  const handleSetNewPin = async () => {
    if (!selected) return
    if (!/^\d{4,6}$/.test(newPin)) {
      toast.error('Le PIN doit contenir entre 4 et 6 chiffres')
      return
    }
    if (newPin !== confirmNewPin) {
      toast.error('Les deux codes ne correspondent pas')
      return
    }
    setLoading(true)
    try {
      await updateCashier(selected.id, { pin: newPin })
      toast.success('Nouveau PIN enregistré')
      setResetCode('')
      setNewPin('')
      setConfirmNewPin('')
      setOverlay('none')
      setPin('')
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la mise à jour')
    } finally {
      setLoading(false)
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
    <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-900 flex flex-col items-center justify-center gap-6 p-6">
      {onCancel && (
        <button
          onClick={onCancel}
          className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-700 transition-colors"
        >
          <X size={18} />
        </button>
      )}

      <div className="w-56 h-56 shrink-0">
        <Rive key={riveKey} src="/animations/pin-animation.riv" />
      </div>

      {/* ─── Écran unique : sélection + PIN sur la même vue ────────── */}
      {overlay === 'none' && (
        <div className="w-full max-w-sm flex flex-col items-center gap-4">
          {/* En-tête */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              {selected ? `Bonjour, ${selected.name.split(' ')[0]} !` : 'Qui êtes-vous ?'}
            </h2>
            <p className="text-sm text-gray-500">
              {selected ? 'Entrez votre code PIN' : 'Sélectionnez votre profil pour continuer.'}
            </p>
          </div>

          {/* ─── Liste des caissiers en cartes ─── */}
          {!preselectedCashier && (
            <div className="w-full space-y-2 max-h-48 overflow-y-auto">
              {loadingCashiers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : cashiers.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">Aucun caissier actif trouvé.</p>
              ) : (
                cashiers.map((cashier) => (
                  <button
                    key={cashier.id}
                    onClick={() => handleSelectCashier(cashier)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left border border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                    style={{
                      borderColor: selected?.id === cashier.id ? '#c9a84c' : '#f3f4f6',
                      backgroundColor: selected?.id === cashier.id ? '#fdf8ee' : 'transparent',
                    }}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      {cashier.avatarUrl && <AvatarImage src={cashier.avatarUrl} />}
                      <AvatarFallback
                        className="text-sm font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #c9a84c, #a3812f)' }}
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
                    {selected?.id === cashier.id && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#c9a84c]" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {/* ─── PIN Pad (toujours visible si un caissier est sélectionné) ─── */}
          {selected && (
            <div className="w-full flex flex-col items-center gap-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
              {!preselectedCashier && (
                <button
                  onClick={handleDeselect}
                  className="self-start flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Changer de profil
                </button>
              )}

              {/* Indicateurs de PIN */}
              <div className="flex gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full transition-all duration-150"
                    style={{
                      backgroundColor: i < pin.length ? (error ? '#ef4444' : '#c9a84c') : 'transparent',
                      border: `1.5px solid ${error ? '#ef4444' : i < pin.length ? '#c9a84c' : '#d1d5db'}`,
                    }}
                  />
                ))}
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              {/* Pavé numérique */}
              <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px]">
                {['1','2','3','4','5','6','7','8','9'].map((d) => (
                  <button
                    key={d}
                    onClick={() => handleDigit(d)}
                    disabled={loading}
                    className="h-14 rounded-2xl flex items-center justify-center text-lg font-semibold border border-gray-200 dark:border-zinc-700 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30"
                  >
                    {d}
                  </button>
                ))}
                <div />
                <button
                  onClick={() => handleDigit('0')}
                  disabled={loading}
                  className="h-14 rounded-2xl flex items-center justify-center text-lg font-semibold border border-gray-200 dark:border-zinc-700 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30"
                >
                  0
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading || pin.length === 0}
                  className="h-14 rounded-2xl flex items-center justify-center text-lg transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : '⌫'}
                </button>
              </div>

              <button
                onClick={handleForgotPin}
                disabled={sendingReset}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline flex items-center gap-1"
              >
                <Mail className="h-3 w-3" />
                {sendingReset ? 'Envoi en cours...' : 'PIN oublié ?'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Compte bloqué ──────────────────────────────────────────── */}
      {overlay === 'locked' && selected && (
        <div className="text-center flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 shrink-0">
              {selected.avatarUrl && <AvatarImage src={selected.avatarUrl} />}
              <AvatarFallback
                className="text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #c9a84c, #a3812f)' }}
              >
                {initials(selected.name)}
              </AvatarFallback>
            </Avatar>
            <span className="font-semibold text-sm">{selected.name}</span>
          </div>
          <p className="text-sm text-red-500">
            Trop de tentatives. Réessayez dans {formatTime(remainingSeconds)}.
          </p>
          <button
            onClick={handleForgotPin}
            disabled={sendingReset}
            className="text-xs text-gray-400 hover:text-gray-600 underline flex items-center gap-1"
          >
            <Mail className="h-3 w-3" />
            {sendingReset ? 'Envoi en cours...' : "J'ai un code, réinitialiser maintenant"}
          </button>
          <button
            onClick={() => { setOverlay('none'); handleDeselect() }}
            className="text-xs text-gray-400 hover:text-gray-600 mt-2"
          >
            Choisir un autre profil
          </button>
        </div>
      )}

      {/* ─── Code reçu par l'admin ─────────────────────────────────── */}
      {overlay === 'forgot-code' && selected && (
        <div className="w-full max-w-sm space-y-4">
          <button
            onClick={() => { setOverlay('none'); setResetCode(''); setResetError('') }}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <h2 className="text-lg font-bold text-center text-gray-900 dark:text-white">
            Code reçu par l'administrateur
          </h2>
          <p className="text-sm text-gray-500 text-center">
            Demandez le code à 6 chiffres envoyé à l'administrateur (valable 15 minutes).
          </p>
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={resetCode}
            onChange={(e) => { setResetCode(e.target.value.replace(/\D/g, '')); setResetError('') }}
            placeholder="123456"
            className="rounded-xl text-center text-lg tracking-widest"
            autoFocus
          />
          {resetError && <p className="text-center text-sm text-red-500">{resetError}</p>}
          <Button
            onClick={handleVerifyResetCode}
            disabled={resetCode.length < 4 || loading}
            className="w-full rounded-xl"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Valider le code'}
          </Button>
        </div>
      )}

      {/* ─── Nouveau PIN ────────────────────────────────────────────── */}
      {overlay === 'forgot-newpin' && selected && (
        <div className="w-full max-w-sm space-y-4">
          <h2 className="text-lg font-bold text-center text-gray-900 dark:text-white">
            Nouveau code PIN
          </h2>
          <p className="text-sm text-gray-500 text-center">
            Choisissez un nouveau code PIN à 4-6 chiffres pour {selected.name}.
          </p>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Nouveau PIN"
            className="rounded-xl text-center text-lg tracking-widest"
          />
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={confirmNewPin}
            onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Confirmer"
            className="rounded-xl text-center text-lg tracking-widest"
          />
          <Button onClick={handleSetNewPin} disabled={loading} className="w-full rounded-xl">
            {loading ? 'Enregistrement...' : 'Enregistrer le nouveau PIN'}
          </Button>
        </div>
      )}
    </div>
  )
}