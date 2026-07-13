'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/src/lib/supabase'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { ArrowLeft, Save, Mail, ShieldCheck, Key, Eye, EyeOff } from 'lucide-react'
import { hasPinDefined, setPinCode, checkPinMatches } from '@/lib/pin-storage'

const PRIMARY = '#2C3E50'

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  // ─── Section code PIN ───────────────────────────────────────────
  const [pinDefined, setPinDefined] = useState(false)
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPins, setShowPins] = useState(false)
  const [savingPin, setSavingPin] = useState(false)

  useEffect(() => {
    loadUser()
    setPinDefined(hasPinDefined())
  }, [])

  const loadUser = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      const sessionUser = data.session?.user
      if (!sessionUser) {
        router.push('/')
        return
      }
      setUser(sessionUser)
      setFullName(sessionUser.user_metadata?.full_name || '')
      setPhone(sessionUser.user_metadata?.phone || '')
    } catch (error) {
      console.error(error)
      toast.error('Erreur chargement du profil')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }
    setSaving(true)
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
        },
      })
      if (error) throw error
      setUser(data.user)
      toast.success('Profil mis à jour avec succès')
    } catch (error: any) {
      console.error(error)
      toast.error(error?.message || 'Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  // ─── Créer / changer le code PIN ─────────────────────────────────
  const resetPinFields = () => {
    setOldPin('')
    setNewPin('')
    setConfirmPin('')
  }

  const handleSubmitPin = async () => {
    if (pinDefined) {
      if (!/^\d{4,6}$/.test(oldPin)) {
        toast.error('Entrez votre code PIN actuel')
        return
      }
      const matches = await checkPinMatches(oldPin)
      if (!matches) {
        toast.error('Code PIN actuel incorrect')
        return
      }
    }

    if (!/^\d{4,6}$/.test(newPin)) {
      toast.error('Le nouveau PIN doit contenir entre 4 et 6 chiffres')
      return
    }
    if (newPin !== confirmPin) {
      toast.error('Les deux nouveaux codes ne correspondent pas')
      return
    }
    if (pinDefined && newPin === oldPin) {
      toast.error("Le nouveau PIN doit être différent de l'ancien")
      return
    }

    setSavingPin(true)
    try {
      await setPinCode(newPin)
      setPinDefined(true)
      resetPinFields()
      toast.success(
        pinDefined
          ? 'Votre code PIN a été mis à jour'
          : "Code PIN défini. Activez le verrouillage dans Paramètres pour l'utiliser."
      )
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la mise à jour du PIN')
    } finally {
      setSavingPin(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    )
  }

  if (!user) return null

  const avatarUrl = user.user_metadata?.avatar_url
  const email = user.email || ''
  const initials = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase() || 'U'

  const authProvider = user.app_metadata?.provider || 'google'

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.push('/dashboard')} className="gap-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mon profil</h1>
      </div>

      <Card className="rounded-2xl border shadow-sm mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20" style={{ boxShadow: `0 0 0 3px ${PRIMARY}33` }}>
              <AvatarImage src={avatarUrl} referrerPolicy="no-referrer" />
              <AvatarFallback
                className="text-xl font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg text-gray-900 dark:text-white truncate">
                {fullName || 'Commerçant'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{email}</p>
              <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs text-gray-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Connecté via {authProvider === 'google' ? 'Google' : authProvider}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            La photo de profil provient de votre compte Google et ne peut pas être modifiée ici.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border shadow-sm mb-6">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Nom complet <span className="text-red-500">*</span>
            </Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rounded-xl h-11 border-gray-200 dark:border-gray-700"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Téléphone
            </Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+212 6XX XXX XXX"
              className="rounded-xl h-11 border-gray-200 dark:border-gray-700"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Email
            </Label>
            <Input
              value={email}
              disabled
              className="rounded-xl h-11 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500"
            />
            <p className="text-xs text-gray-400">
              L'email est lié à votre compte Google et ne peut pas être modifié ici.
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-xl text-white h-11"
            style={{ backgroundColor: PRIMARY }}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </Button>
        </CardContent>
      </Card>

      {/* ─── SECTION CODE PIN ─────────────────────────────────────── */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Key className="h-5 w-5 text-gray-500" />
            {pinDefined ? 'Changer mon code PIN' : 'Définir un code PIN'}
          </CardTitle>
          <CardDescription>
            {pinDefined
              ? "Ce code sert à verrouiller l'application. L'activation du verrouillage se fait dans Paramètres."
              : "Définissez un code PIN pour pouvoir activer le verrouillage de l'application dans Paramètres."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pinDefined && (
            <div className="space-y-1.5">
              <Label>Code PIN actuel</Label>
              <div className="relative">
                <Input
                  type={showPins ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                  className="rounded-xl h-11 tracking-widest pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPins((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPins ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{pinDefined ? 'Nouveau code PIN' : 'Code PIN'}</Label>
            <Input
              type={showPins ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={6}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              className="rounded-xl h-11 tracking-widest"
            />
          </div>

          <div className="space-y-1.5">
            <Label>{pinDefined ? 'Confirmer le nouveau code PIN' : 'Confirmer le code PIN'}</Label>
            <Input
              type={showPins ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              className="rounded-xl h-11 tracking-widest"
            />
          </div>

          <Button
            onClick={handleSubmitPin}
            disabled={savingPin}
            className="w-full rounded-xl text-white h-11"
            style={{ backgroundColor: PRIMARY }}
          >
            {savingPin ? 'Enregistrement...' : pinDefined ? 'Mettre à jour mon PIN' : 'Définir mon PIN'}
          </Button>

          {pinDefined && (
            <p className="text-xs text-gray-400 text-center">
              PIN oublié ? Utilisez "Réinitialiser par email" depuis l'écran de verrouillage.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}