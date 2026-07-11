'use client'

/**
 * components/users/UserFormDialog.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Create or Edit a cashier profile.
 * Shows: name, email (optional), PIN, avatar (optional), permissions.
 *
 * Permissions step:
 *  - "Utiliser les permissions par défaut" → DEFAULT_CASHIER_PERMISSIONS
 *  - "Personnaliser les permissions" → tous les modules affichés avec cases à cocher
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
import { Loader2, Camera, Eye, EyeOff, LayoutDashboard, ShoppingBag, Package, Receipt, Users, Wallet, Settings, Shield, Bot, Bell } from 'lucide-react'
import {
  createCashier, updateCashier,
  type AppUserRow, type CreateCashierInput, type UpdateCashierInput,
} from '@/lib/user-data'
import {
  PERMISSION_MODULES, 
  DEFAULT_CASHIER_PERMISSIONS, 
  normalizePermissions,
  type Permission,
  PERMISSIONS,
  PRODUCTS_DEPENDENT_ACTIONS,
  CLIENTS_DEPENDENT_ACTIONS,
} from '@/lib/rbac'

interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editUser?: AppUserRow | null
  onSaved: () => void
}

// ─── Icônes par module ────────────────────────────────────────────
const moduleIcons: Record<string, any> = {
  dashboard: LayoutDashboard,
  pos: ShoppingBag,
  products: Package,
  clients: Users,
  invoices: Receipt,
  finance: Wallet,
  settings: Settings,
  features: Bot, // pour le module Fonctionnalités (IA + Notifications)
}

export function UserFormDialog({ open, onOpenChange, editUser, onSaved }: UserFormDialogProps) {
  const isEdit = !!editUser

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [customize, setCustomize] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      if (editUser) {
        setName(editUser.name)
        setEmail(editUser.email || '')
        setAvatarUrl(editUser.avatarUrl)
        setPermissions(editUser.permissions)
        // If the existing permissions differ from the default preset,
        // open the form in "customize" mode so nothing is silently reset.
        const isDefault =
          editUser.permissions.length === DEFAULT_CASHIER_PERMISSIONS.length &&
          DEFAULT_CASHIER_PERMISSIONS.every((p) => editUser.permissions.includes(p))
        setCustomize(!isDefault)
      } else {
        setName('')
        setEmail('')
        setAvatarUrl(null)
        setPermissions(DEFAULT_CASHIER_PERMISSIONS)
        setCustomize(false)
      }
      setPin('')
      setConfirmPin('')
      setShowPin(false)
    }
  }, [open, editUser])

  const isFinanceModule = (moduleKey: string) => moduleKey === 'finance'

  /**
   * Master "Accéder" checkbox for a module: select/clear everything inside it.
   * Si coché → toutes les actions sont cochées
   * Si décoché → toutes les actions sont décochées
   */
  const toggleModuleAccess = (moduleKey: string) => {
    const mod = PERMISSION_MODULES.find((m) => m.key === moduleKey)
    if (!mod) return

    const allActionKeys = mod.actions.map((a) => a.key)
    const allChecked = allActionKeys.length > 0 && allActionKeys.every((k) => permissions.includes(k))

    setPermissions((prev) => {
      const set = new Set(prev)
      if (allChecked) {
        // currently fully selected → clear everything in this module
        set.delete(mod.access)
        allActionKeys.forEach((k) => set.delete(k))
      } else {
        // not fully selected → select everything in this module
        set.add(mod.access)
        allActionKeys.forEach((k) => set.add(k))
      }
      return Array.from(set)
    })
  }

  /**
   * Toggle a single action permission.
   * Si une action est cochée → "Accéder" est automatiquement coché
   * Si toutes les actions sont décochées → "Accéder" est automatiquement décoché
   */
  const toggleAction = (key: Permission) => {
    setPermissions((prev) => {
      const newSet = new Set(prev)
      
      // Toggle l'action
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }

      // Trouver le module de cette action
      const mod = PERMISSION_MODULES.find((m) => 
        m.actions.some((a) => a.key === key)
      )
      
      if (mod && mod.key !== 'finance' && mod.key !== 'features') {
        // Vérifier si au moins une action est cochée
        const hasAnyAction = mod.actions.some((a) => newSet.has(a.key))
        if (hasAnyAction) {
          // Si une action est cochée, cocher automatiquement "Accéder"
          newSet.add(mod.access)
        } else {
          // Si aucune action n'est cochée, décocher "Accéder"
          newSet.delete(mod.access)
        }
      }

      // ─── LOGIQUE SPÉCIALE PRODUITS ──────────────────────────────

      // Cas 1: On coche "Voir" → on coche automatiquement toutes les actions dépendantes
      if (mod?.key === 'products' && key === PERMISSIONS.PRODUCTS_VIEW && newSet.has(key)) {
        PRODUCTS_DEPENDENT_ACTIONS.forEach((actionKey) => {
          newSet.add(actionKey)
        })
      }

      // Cas 2: On décoche "Voir" → on décoche toutes les actions dépendantes
      if (mod?.key === 'products' && key === PERMISSIONS.PRODUCTS_VIEW && !newSet.has(key)) {
        PRODUCTS_DEPENDENT_ACTIONS.forEach((actionKey) => {
          newSet.delete(actionKey)
        })
      }

      // Cas 3: On essaie de cocher une action dépendante sans "Voir"
      if (mod?.key === 'products' && PRODUCTS_DEPENDENT_ACTIONS.includes(key) && newSet.has(key)) {
        if (!newSet.has(PERMISSIONS.PRODUCTS_VIEW)) {
          newSet.delete(key)
          toast.warning('Vous devez d\'abord activer "Voir" pour cette action')
        }
      }

      // ─── LOGIQUE SPÉCIALE CLIENTS ──────────────────────────────

      // Cas 1: On coche "Voir" → on coche automatiquement toutes les actions dépendantes
      if (mod?.key === 'clients' && key === PERMISSIONS.CLIENTS_VIEW && newSet.has(key)) {
        CLIENTS_DEPENDENT_ACTIONS.forEach((actionKey) => {
          newSet.add(actionKey)
        })
      }

      // Cas 2: On décoche "Voir" → on décoche toutes les actions dépendantes
      if (mod?.key === 'clients' && key === PERMISSIONS.CLIENTS_VIEW && !newSet.has(key)) {
        CLIENTS_DEPENDENT_ACTIONS.forEach((actionKey) => {
          newSet.delete(actionKey)
        })
      }

      // Cas 3: On essaie de cocher une action dépendante sans "Voir"
      if (mod?.key === 'clients' && CLIENTS_DEPENDENT_ACTIONS.includes(key) && newSet.has(key)) {
        if (!newSet.has(PERMISSIONS.CLIENTS_VIEW)) {
          newSet.delete(key)
          toast.warning('Vous devez d\'abord activer "Voir" pour cette action')
        }
      }

      return Array.from(newSet)
    })
  }

  /**
   * État de la case "Accéder" : true (coché), false (décoché), 'indeterminate' (partiel)
   */
  const moduleAccessState = (moduleKey: string): boolean | 'indeterminate' => {
    const mod = PERMISSION_MODULES.find((m) => m.key === moduleKey)
    if (!mod) return false
    const allActionKeys = mod.actions.map((a) => a.key)
    if (allActionKeys.length === 0) return permissions.includes(mod.access)
    const checkedCount = allActionKeys.filter((k) => permissions.includes(k)).length
    if (checkedCount === 0) return false
    if (checkedCount === allActionKeys.length) return true
    return 'indeterminate'
  }

  /**
   * Vérifie si une action est désactivée
   */
  const isActionDisabled = (key: Permission): boolean => {
    const mod = PERMISSION_MODULES.find((m) => 
      m.actions.some((a) => a.key === key)
    )
    
    // Pour Produits
    if (mod?.key === 'products' && PRODUCTS_DEPENDENT_ACTIONS.includes(key)) {
      return !permissions.includes(PERMISSIONS.PRODUCTS_VIEW)
    }
    
    // Pour Clients
    if (mod?.key === 'clients' && CLIENTS_DEPENDENT_ACTIONS.includes(key)) {
      return !permissions.includes(PERMISSIONS.CLIENTS_VIEW)
    }
    
    // Factures: pas de désactivation
    // Finances: pas de désactivation
    // Features (IA + Notifications): pas de désactivation
    
    return false
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

    const finalPermissions = customize
      ? normalizePermissions(permissions)
      : DEFAULT_CASHIER_PERMISSIONS

    setSaving(true)
    try {
      if (isEdit && editUser) {
        const input: UpdateCashierInput = {
          name: name.trim(),
          email: email.trim() || null,
          avatarUrl,
          permissions: finalPermissions,
          ...(pin ? { pin } : {}),
        }
        await updateCashier(editUser.id, input)
        toast.success('Caissier mis à jour')
      } else {
        const input: CreateCashierInput = {
          name: name.trim(),
          pin,
          email: email.trim() || null,
          avatarUrl,
          permissions: finalPermissions,
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
              ? 'Mettez à jour les informations du caissier.'
              : 'Créez un nouveau profil caissier.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* ─── Avatar ─────────────────────────────────────────────── */}
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

          {/* ─── Nom ────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>Nom complet <span className="text-red-500">*</span></Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom complet du caissier"
              className="rounded-xl"
            />
          </div>

          {/* ─── Email ───────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>Email <span className="text-gray-400 text-xs">(optionnel)</span></Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemple.com"
              className="rounded-xl"
            />
          </div>

          {/* ─── PIN ─────────────────────────────────────────────────── */}
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

          {/* ─── PERMISSIONS ─────────────────────────────────────────── */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Permissions</Label>

            {/* Choix : défaut ou personnalisé */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setCustomize(false)}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                  !customize
                    ? 'border-sky-400 bg-sky-50 dark:bg-sky-950/30'
                    : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
                }`}
              >
                <div
                  className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    !customize ? 'border-sky-500' : 'border-gray-300'
                  }`}
                >
                  {!customize && <div className="w-2 h-2 rounded-full bg-sky-500" />}
                </div>
                <div>
                  <p className="text-sm font-medium">Utiliser les permissions par défaut</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Tableau de bord, caisse, produits (voir), clients (voir), factures (voir)
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCustomize(true)}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                  customize
                    ? 'border-sky-400 bg-sky-50 dark:bg-sky-950/30'
                    : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
                }`}
              >
                <div
                  className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    customize ? 'border-sky-500' : 'border-gray-300'
                  }`}
                >
                  {customize && <div className="w-2 h-2 rounded-full bg-sky-500" />}
                </div>
                <p className="text-sm font-medium">Personnaliser les permissions</p>
              </button>
            </div>

            {/* Modules détaillés — affichés uniquement en mode personnalisé */}
            {customize && (
              <div className="space-y-4 pt-2">
                {PERMISSION_MODULES.map((mod) => {
                  const isFinance = mod.key === 'finance'
                  const isFeatures = mod.key === 'features'
                  const Icon = moduleIcons[mod.key] || Shield
                  const accessState = moduleAccessState(mod.key)
                  
                  return (
                    <div 
                      key={mod.key} 
                      className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/30"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="h-4 w-4 text-blue-500" />
                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                          {mod.labelFr}
                        </p>
                      </div>

                      {/* Case maîtresse "Accéder" — masquée pour Finances et Features */}
                      {!isFinance && !isFeatures && (
                        <div className="flex items-center gap-3 mb-2">
                          <Checkbox
                            id={`${mod.key}-access`}
                            checked={accessState}
                            onCheckedChange={() => toggleModuleAccess(mod.key)}
                            className="border-gray-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                          />
                          <Label htmlFor={`${mod.key}-access`} className="text-sm font-medium cursor-pointer text-gray-700 dark:text-gray-300">
                            Accéder
                          </Label>
                          {accessState === 'indeterminate' && (
                            <span className="text-xs text-gray-400">(partiel)</span>
                          )}
                        </div>
                      )}

                      <div className={!isFinance && !isFeatures ? 'space-y-2 pl-7' : 'space-y-2'}>
                        {mod.actions.map((action) => {
                          const isDisabled = isActionDisabled(action.key)
                          return (
                            <div key={action.key} className="flex items-start gap-3">
                              <Checkbox
                                id={action.key}
                                checked={permissions.includes(action.key)}
                                onCheckedChange={() => toggleAction(action.key)}
                                disabled={isDisabled}
                                className={`mt-0.5 border-gray-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 ${
                                  isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                              />
                              <Label 
                                htmlFor={action.key} 
                                className={`text-sm font-normal cursor-pointer leading-snug ${
                                  isDisabled 
                                    ? 'text-gray-400 cursor-not-allowed' 
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {action.labelFr}
                                {isDisabled && (
                                  <span className="text-xs text-gray-400 ml-1">(Voir requis)</span>
                                )}
                              </Label>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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