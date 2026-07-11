'use client'

/**
 * components/users/ResetPinDialog.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dialog to reset a cashier's PIN manually.
 * Admin sets a new PIN directly (no email involved).
 */

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, Key, AlertCircle } from 'lucide-react'
import { updateCashier, type AppUserRow } from '@/lib/user-data'

interface ResetPinDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AppUserRow | null
  onRefresh: () => void
}

export function ResetPinDialog({ open, onOpenChange, user, onRefresh }: ResetPinDialogProps) {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!user) return null

  const handleReset = async () => {
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error('Le PIN doit contenir entre 4 et 6 chiffres')
      return
    }
    if (pin !== confirmPin) {
      toast.error('Les deux codes PIN ne correspondent pas')
      return
    }

    setSaving(true)
    try {
      await updateCashier(user.id, { pin })
      toast.success(`PIN de ${user.name} réinitialisé avec succès`)
      onRefresh()
      onOpenChange(false)
      setPin('')
      setConfirmPin('')
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la réinitialisation')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setPin('')
    setConfirmPin('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-amber-500" />
            Réinitialiser le PIN
          </DialogTitle>
          <DialogDescription>
            Définir un nouveau code PIN pour <span className="font-semibold">{user.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>Nouveau code PIN</Label>
            <div className="relative">
              <Input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4 à 6 chiffres"
                className="rounded-xl pr-10 tracking-widest"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Confirmer le code PIN</Label>
            <Input
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Retapez le code PIN"
              className="rounded-xl tracking-widest"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              Le nouveau PIN sera appliqué immédiatement. Le caissier devra utiliser ce nouveau code pour se connecter.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} className="rounded-xl">
            Annuler
          </Button>
          <Button
            onClick={handleReset}
            disabled={saving || !pin || pin !== confirmPin}
            className="rounded-xl text-white bg-amber-500 hover:bg-amber-600"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Réinitialiser
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}