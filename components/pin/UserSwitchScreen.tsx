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
 *  4. On success → calls onSuccess(appUser).
 */

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { getActiveCashiers, verifyCashierPin, type AppUserRow } from '@/lib/user-data'
import type { AppUser } from '@/context/UserContext'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface UserSwitchScreenProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (user: AppUser) => void
}

type Step = 'select' | 'pin'

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

  useEffect(() => {
    if (open) {
      setStep('select')
      setSelected(null)
      setPin('')
      setError('')
      loadCashiers()
    }
  }, [open])

  useEffect(() => {
    if (step === 'pin') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [step])

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
    const next = pin + digit
    setPin(next)
    setError('')
    if (next.length >= 4) {
      // Auto-submit once we hit 4+ digits and let the user confirm with the button
      // (or we can auto-verify at 4 if they didn't set a 6-digit pin)
    }
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
      const verified = await verifyCashierPin(selected.id, pin)
      if (!verified) {
        setError('Code PIN incorrect. Réessayez.')
        setPin('')
        inputRef.current?.focus()
        return
      }
      const appUser: AppUser = {
        id: verified.id,
        name: verified.name,
        email: verified.email,
        phone: verified.phone,
        avatarUrl: verified.avatarUrl,
        role: verified.role,
        permissions: verified.permissions,
      }
      onSuccess(appUser)
      onOpenChange(false)
    } catch {
      setError('Erreur lors de la vérification.')
    } finally {
      setLoading(false)
    }
  }

  const initials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-2xl p-0 overflow-hidden">
        {step === 'select' ? (
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
        ) : (
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
              {/* PIN dots */}
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

              {/* Hidden input for physical keyboard */}
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

              {/* Numpad */}
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
      </DialogContent>
    </Dialog>
  )
}
