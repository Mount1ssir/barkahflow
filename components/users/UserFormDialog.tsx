'use client'

/**
 * components/users/UserFormDialog.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Create or Edit a cashier profile.
 * Shows: name, PIN, phone (optional), avatar (optional), permission checklist.
 */

import { useState, useEffect, useRef } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { Loader2, Camera, Eye, EyeOff } from 'lucide-react'
import {
  createCashier, updateCashier,
  type AppUserRow, type CreateCashierInput, type UpdateCashierInput,
} from '@/lib/user-data'
import { ASSIGNABLE_PERMISSIONS, type Permission } from '@/lib/rbac'

interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** If provided, we are editing an existing cashier */
  editUser?: AppUserRow | null
  onSaved: () => void
}

export function UserFormDialog({ open, onOpenChange, editUser, onSaved }: UserFormDialogProps) {
  const isEdit = !!editUser

  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Group permissions for display
  const groups = Array.from(new Set(ASSIGNABLE_PERMISSIONS.map((p) => p.group)))

  useEffect(() => {
    if (open) {
      if (editUser) {
        setName(editUser.name)
        setPhone(editUser.phone || '')
        setAvatarUrl(editUser.avatarUrl)
        setPermissions(editUser.permissions)
      } else {
        setName('')
        setPhone('')
        setAvatarUrl(null)
        setPermissions([])
      }
      setPin('')
      setConfirmPin('')
      setShowPin(false)
    }
  }, [open, editUser])

  const togglePermission = (key: Permission) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    )
  }

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Le nom est requis')
      return
    }
    if (!isEdit) {
      if (!/^\d{4,6}$/.test(pin)) {
        toast.error('Le PIN doit contenir entre 4 et 6 chiffres')
        return
      }
      if (pin !== confirmPin) {
        toast.error('Les deux codes PIN ne correspondent pas')
        return
      }
    } else if (pin && pin !== confirmPin) {
      toast.error('Les deux codes PIN ne correspondent pas')
      return
    } else if (pin && !/^\d{4,6}$/.test(pin)) {
      toast.error('Le PIN doit contenir entre 4 et 6 chiffres')
      return
    }

    setSaving(true)
    try {
      if (isEdit && editUser) {
        const input: UpdateCashierInput = {
          name: name.trim(),
          phone: phone || null,
          avatarUrl,
          permissions,
          ...(pin ? { pin } : {}),
        }
        await updateCashier(editUser.id, input)
        toast.success('Caissier mis à jour')
      } else {
        const input: CreateCashierInput = {
          name: name.trim(),
          pin,
          phone: phone || null,
          avatarUrl,
          permissions,
        }
        await createCashier(input)
        toast.success('Caissier créé avec succès')
      }
      onSaved()
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le caissier' : 'Nouveau caissier'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Mettez à jour les informations et permissions du caissier.'
              : 'Créez un nouveau profil caissier avec ses permissions.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Avatar */}
          <div className="flex justify-center">
            <div className="relative">
              <Avatar className="h-20 w-20 cursor-pointer" onClick={() => fileRef.current?.click()}>
                {avatarUrl && <AvatarImage src={avatarUrl} />}
                <AvatarFallback
                  className="text-lg font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #38BDF8, #0EA5E9)' }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-zinc-800 border-2 border-gray-200 dark:border-zinc-700 flex items-center justify-center shadow-sm hover:bg-gray-50"
              >
                <Camera className="w-3.5 h-3.5 text-gray-500" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarPick}
              />
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label>Nom complet <span className="text-red-500">*</span></Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom complet du caissier"
              className="rounded-xl"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label>Téléphone <span className="text-gray-400 text-xs">(optionnel)</span></Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+212 6 00 00 00 00"
              inputMode="tel"
              className="rounded-xl"
            />
          </div>

          {/* PIN */}
          <div className="space-y-1.5">
            <Label>
              Code PIN {!isEdit && <span className="text-red-500">*</span>}
              {isEdit && <span className="text-gray-400 text-xs ml-1">(laisser vide pour ne pas changer)</span>}
            </Label>
            <div className="relative">
              <Input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4 à 6 chiffres"
                className="rounded-xl pr-10 tracking-widest"
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

          {(pin || !isEdit) && (
            <div className="space-y-1.5">
              <Label>Confirmer le PIN</Label>
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
          )}

          {/* Permissions checklist */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Permissions</Label>
            <p className="text-xs text-gray-400 -mt-1">
              Cochez les modules auxquels ce caissier aura accès.
            </p>
            {groups.map((group) => (
              <div key={group} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{group}</p>
                {ASSIGNABLE_PERMISSIONS.filter((p) => p.group === group).map((perm) => (
                  <div key={perm.key} className="flex items-start gap-3">
                    <Checkbox
                      id={perm.key}
                      checked={permissions.includes(perm.key)}
                      onCheckedChange={() => togglePermission(perm.key)}
                      className="mt-0.5"
                    />
                    <Label htmlFor={perm.key} className="text-sm font-normal cursor-pointer leading-snug">
                      {perm.labelFr}
                    </Label>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl text-white"
            style={{ backgroundColor: '#38BDF8' }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isEdit ? 'Enregistrer' : 'Créer le caissier'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
