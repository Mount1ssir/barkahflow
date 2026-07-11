'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Camera, Eye, EyeOff, User, Mail, Key, Shield, Users, Package, Receipt, ShoppingBag, LayoutDashboard, Wallet, Settings, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getUserById, updateCashier, type AppUserRow, type UpdateCashierInput } from '@/lib/user-data'
import { PERMISSION_MODULES, DEFAULT_CASHIER_PERMISSIONS, normalizePermissions, type Permission, PERMISSIONS } from '@/lib/rbac'
import { Guard } from '@/components/rbac/Guard'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Couleurs ──────────────────────────────────────────────────────
const BLUE_SOFT = '#93C5FD'
const BLUE = '#3B82F6'
const BLUE_DARK = '#1D4ED8'

// ─── Icônes par module ────────────────────────────────────────────
const moduleIcons: Record<string, any> = {
  dashboard: LayoutDashboard,
  pos: ShoppingBag,
  products: Package,
  clients: Users,
  invoices: Receipt,
  finance: Wallet,
  settings: Settings,
  features: Settings,
}

function EditerCaissierContent() {
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string

  // ─── États ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AppUserRow | null>(null)
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

  // ─── Chargement de l'utilisateur ──────────────────────────────────
  useEffect(() => {
    async function loadUser() {
      if (!userId) return
      try {
        const data = await getUserById(userId)
        if (!data) {
          toast.error('Utilisateur introuvable')
          router.push('/dashboard/settings/utilisateurs')
          return
        }
        setUser(data)
        setName(data.name)
        setEmail(data.email || '')
        setAvatarUrl(data.avatarUrl)
        setPermissions(data.permissions)
        
        const isDefault =
          data.permissions.length === DEFAULT_CASHIER_PERMISSIONS.length &&
          DEFAULT_CASHIER_PERMISSIONS.every((p) => data.permissions.includes(p))
        setCustomize(!isDefault)
      } catch (error) {
        console.error(error)
        toast.error('Erreur lors du chargement de l\'utilisateur')
        router.push('/dashboard/settings/utilisateurs')
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [userId, router])

  // ─── Gestion des permissions ──────────────────────────────────────
  const isFinanceModule = (moduleKey: string) => moduleKey === 'finance'
  const isFeaturesModule = (moduleKey: string) => moduleKey === 'features'

  const toggleModuleAccess = (moduleKey: string) => {
    const mod = PERMISSION_MODULES.find((m) => m.key === moduleKey)
    if (!mod) return

    const allActionKeys = mod.actions.map((a) => a.key)
    const allChecked = allActionKeys.length > 0 && allActionKeys.every((k) => permissions.includes(k))

    setPermissions((prev) => {
      const set = new Set(prev)
      if (allChecked) {
        set.delete(mod.access)
        allActionKeys.forEach((k) => set.delete(k))
      } else {
        set.add(mod.access)
        allActionKeys.forEach((k) => set.add(k))
      }
      return Array.from(set)
    })
  }

  const toggleAction = (key: Permission) => {
    setPermissions((prev) => {
      const newSet = new Set(prev)
      
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }

      const mod = PERMISSION_MODULES.find((m) => 
        m.actions.some((a) => a.key === key)
      )
      
      if (mod && mod.key !== 'finance' && mod.key !== 'features') {
        const hasAnyAction = mod.actions.some((a) => newSet.has(a.key))
        if (hasAnyAction) {
          newSet.add(mod.access)
        } else {
          newSet.delete(mod.access)
        }
      }

      // ─── LOGIQUE SPÉCIALE PRODUITS ──────────────────────────────
      if (mod?.key === 'products' && key === PERMISSIONS.PRODUCTS_VIEW && newSet.has(key)) {
        const actions: Permission[] = [
          PERMISSIONS.PRODUCTS_EDIT,
          PERMISSIONS.PRODUCTS_DELETE,
          PERMISSIONS.PRODUCTS_RESTOCK,
          PERMISSIONS.PRODUCTS_DEACTIVATE,
          PERMISSIONS.PRODUCTS_HISTORY,
        ]
        actions.forEach((actionKey) => newSet.add(actionKey))
      }
      if (mod?.key === 'products' && key === PERMISSIONS.PRODUCTS_VIEW && !newSet.has(key)) {
        const actions: Permission[] = [
          PERMISSIONS.PRODUCTS_EDIT,
          PERMISSIONS.PRODUCTS_DELETE,
          PERMISSIONS.PRODUCTS_RESTOCK,
          PERMISSIONS.PRODUCTS_DEACTIVATE,
          PERMISSIONS.PRODUCTS_HISTORY,
        ]
        actions.forEach((actionKey) => newSet.delete(actionKey))
      }

      // ─── LOGIQUE SPÉCIALE CLIENTS ──────────────────────────────
      if (mod?.key === 'clients' && key === PERMISSIONS.CLIENTS_VIEW && newSet.has(key)) {
        const actions: Permission[] = [
          PERMISSIONS.CLIENTS_EDIT,
          PERMISSIONS.CLIENTS_DELETE,
          PERMISSIONS.CLIENTS_EXPORT,
        ]
        actions.forEach((actionKey) => newSet.add(actionKey))
      }
      if (mod?.key === 'clients' && key === PERMISSIONS.CLIENTS_VIEW && !newSet.has(key)) {
        const actions: Permission[] = [
          PERMISSIONS.CLIENTS_EDIT,
          PERMISSIONS.CLIENTS_DELETE,
          PERMISSIONS.CLIENTS_EXPORT,
        ]
        actions.forEach((actionKey) => newSet.delete(actionKey))
      }

      return Array.from(newSet)
    })
  }

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

  const isActionDisabled = (key: Permission): boolean => {
    const mod = PERMISSION_MODULES.find((m) => 
      m.actions.some((a) => a.key === key)
    )
    
    if (mod?.key === 'products') {
      const dependentActions: Permission[] = [
        PERMISSIONS.PRODUCTS_EDIT,
        PERMISSIONS.PRODUCTS_DELETE,
        PERMISSIONS.PRODUCTS_RESTOCK,
        PERMISSIONS.PRODUCTS_DEACTIVATE,
        PERMISSIONS.PRODUCTS_HISTORY,
      ]
      if (dependentActions.includes(key)) {
        return !permissions.includes(PERMISSIONS.PRODUCTS_VIEW)
      }
    }
    
    if (mod?.key === 'clients') {
      const dependentActions: Permission[] = [
        PERMISSIONS.CLIENTS_EDIT,
        PERMISSIONS.CLIENTS_DELETE,
        PERMISSIONS.CLIENTS_EXPORT,
      ]
      if (dependentActions.includes(key)) {
        return !permissions.includes(PERMISSIONS.CLIENTS_VIEW)
      }
    }
    
    return false
  }

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ─── Sauvegarde ────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Le nom est requis')
      return
    }
    if (pin && pin !== confirmPin) {
      toast.error('Les deux codes PIN ne correspondent pas')
      return
    }
    if (pin && !/^\d{4,6}$/.test(pin)) {
      toast.error('Le PIN doit contenir entre 4 et 6 chiffres')
      return
    }

    const finalPermissions = customize
      ? normalizePermissions(permissions)
      : DEFAULT_CASHIER_PERMISSIONS

    setSaving(true)
    try {
      const input: UpdateCashierInput = {
        name: name.trim(),
        email: email.trim() || null,
        avatarUrl,
        permissions: finalPermissions,
        ...(pin ? { pin } : {}),
      }
      await updateCashier(userId, input)
      toast.success('Caissier mis à jour avec succès')
      router.push('/dashboard/settings/utilisateurs')
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  // ─── Affichage du chargement ──────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <h2 className="text-xl font-bold text-red-500">Utilisateur introuvable</h2>
        <Button 
          className="mt-4 rounded-xl" 
          onClick={() => router.push('/dashboard/settings/utilisateurs')}
        >
          Retour à la liste
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/20"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Modifier le caissier
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Mettez à jour les informations et permissions de {user.name}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* ─── Informations générales ───────────────────────────── */}
        <Card className="rounded-2xl border shadow-sm bg-white dark:bg-gray-900" style={{ borderColor: BLUE_SOFT }}>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
              <User className="h-5 w-5 text-blue-500" />
              Informations générales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar */}
            <div className="flex justify-center">
              <div className="relative">
                <Avatar className="h-24 w-24 cursor-pointer" onClick={() => fileRef.current?.click()}>
                  {avatarUrl && <AvatarImage src={avatarUrl} />}
                  <AvatarFallback
                    className="text-2xl font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border-2 border-gray-200 dark:border-zinc-700 flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors"
                >
                  <Camera className="w-4 h-4 text-gray-500" />
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

            {/* Nom */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Nom complet <span className="text-red-500">*</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom complet du caissier"
                className="rounded-xl h-11 border-gray-200 dark:border-gray-700 focus:border-blue-400 focus:ring-blue-400"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                Email <span className="text-gray-400 text-xs">(optionnel)</span>
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemple.com"
                className="rounded-xl h-11 border-gray-200 dark:border-gray-700 focus:border-blue-400 focus:ring-blue-400"
              />
            </div>

            {/* PIN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Key className="h-4 w-4 text-gray-400" />
                  Nouveau PIN <span className="text-gray-400 text-xs">(laisser vide pour ne pas changer)</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="4 à 6 chiffres"
                    className="rounded-xl h-11 pr-10 tracking-widest border-gray-200 dark:border-gray-700 focus:border-blue-400 focus:ring-blue-400"
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
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirmer le nouveau PIN
                </Label>
                <Input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Retapez le code PIN"
                  className="rounded-xl h-11 tracking-widest border-gray-200 dark:border-gray-700 focus:border-blue-400 focus:ring-blue-400"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Permissions ────────────────────────────────────────── */}
        <Card className="rounded-2xl border shadow-sm bg-white dark:bg-gray-900" style={{ borderColor: BLUE_SOFT }}>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
              <Shield className="h-5 w-5 text-blue-500" />
              Permissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Choix : défaut ou personnalisé */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setCustomize(false)}
                className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                  !customize
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    !customize ? 'border-blue-500' : 'border-gray-300'
                  }`}
                >
                  {!customize && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Utiliser les permissions par défaut
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Tableau de bord, caisse, produits (voir), clients (voir), factures (voir)
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCustomize(true)}
                className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                  customize
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    customize ? 'border-blue-500' : 'border-gray-300'
                  }`}
                >
                  {customize && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Personnaliser les permissions
                </p>
              </button>
            </div>

            {/* Modules détaillés */}
            {customize && (
              <div className="space-y-4 pt-2">
                {PERMISSION_MODULES.map((mod) => {
                  const isFinance = mod.key === 'finance'
                  const isFeatures = mod.key === 'features'
                  const Icon = moduleIcons[mod.key] || Shield
                  
                  return (
                    <div 
                      key={mod.key} 
                      className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/30"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Icon className="h-4 w-4 text-blue-500" />
                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                          {mod.labelFr}
                        </p>
                      </div>

                      {!isFinance && !isFeatures && (
                        <div className="flex items-center gap-3 mb-2">
                          <Checkbox
                            id={`${mod.key}-access`}
                            checked={moduleAccessState(mod.key)}
                            onCheckedChange={() => toggleModuleAccess(mod.key)}
                            className="border-gray-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                          />
                          <Label htmlFor={`${mod.key}-access`} className="text-sm font-medium cursor-pointer text-gray-700 dark:text-gray-300">
                            Accéder
                          </Label>
                          {moduleAccessState(mod.key) === 'indeterminate' && (
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
          </CardContent>
        </Card>

        {/* ─── Actions ────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="rounded-xl h-11 px-6 border-gray-200 dark:border-gray-700"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl h-11 px-8 text-white"
            style={{ backgroundColor: BLUE_DARK }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function EditerCaissierPage() {
  return (
    <Guard permission={PERMISSIONS.SETTINGS_USERS} redirectTo="/dashboard/settings">
      <EditerCaissierContent />
    </Guard>
  )
}