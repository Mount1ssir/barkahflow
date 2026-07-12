'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { toast } from 'sonner'
import { ArrowLeft, Eye, EyeOff, Key, LogOut } from 'lucide-react'
import { useUserContext } from '@/context/UserContext'
import { changeCashierOwnPin } from '@/lib/user-data'
import { supabase } from '@/src/lib/supabase'
import { useTranslation } from 'react-i18next'

const BLUE = '#38BDF8'

export default function CashierProfilePage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { currentUser, setCurrentUser } = useUserContext()

  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPins, setShowPins] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!currentUser || currentUser.role !== 'cashier') {
    return null
  }

  const initials = currentUser.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const handleChangePin = async () => {
    if (!/^\d{4,6}$/.test(oldPin)) {
      toast.error(t('profile_page.enter_current_pin', 'Entrez votre PIN actuel'))
      return
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      toast.error(t('profile_page.enter_valid_pin', 'Le PIN doit contenir entre 4 et 6 chiffres'))
      return
    }
    if (newPin !== confirmPin) {
      toast.error(t('profile_page.pins_dont_match', 'Les PIN ne correspondent pas'))
      return
    }
    if (newPin === oldPin) {
      toast.error(t('profile_page.pin_must_be_different', 'Le nouveau PIN doit être différent de l\'ancien'))
      return
    }

    setSaving(true)
    try {
      const result = await changeCashierOwnPin(currentUser.id, oldPin, newPin)
      if (result.success) {
        toast.success(t('profile_page.pin_changed', 'Code PIN mis à jour'))
        setOldPin('')
        setNewPin('')
        setConfirmPin('')
      } else {
        toast.error(result.error || t('profile_page.error_update', 'Erreur lors de la mise à jour'))
      }
    } catch (err: any) {
      toast.error(err?.message || t('profile_page.error_update', 'Erreur lors de la mise à jour'))
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    // Nettoyer la session
    await supabase.auth.signOut()
    sessionStorage.clear()
    
    // Supprimer l'utilisateur du contexte
    setCurrentUser(null)
    
    // Rediriger vers le dashboard avec le paramètre showSwitch
    // Le layout détectera et affichera l'écran de switch
    router.push('/dashboard?showSwitch=true')
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/dashboard')} className="gap-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" /> {t('profile_page.back', 'Retour')}
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('profile_page.title', 'Mon profil')}</h1>
        </div>
        <Button 
          variant="outline" 
          onClick={handleLogout}
          className="gap-2 rounded-xl text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          {t('profile_page.logout', 'Déconnexion')}
        </Button>
      </div>

      {/* ─── AVATAR + NOM ─── */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl">
        <Avatar className="h-16 w-16" style={{ boxShadow: `0 0 0 3px ${BLUE}33` }}>
          {currentUser.avatarUrl && <AvatarImage src={currentUser.avatarUrl} />}
          <AvatarFallback
            className="text-xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #38BDF8, #0EA5E9)' }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-lg text-gray-900 dark:text-white">
            {currentUser.name}
          </p>
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
            {t('profile_page.cashier_account', 'Compte caissier')}
          </span>
        </div>
      </div>

      {/* ─── SECTION CHANGER LE PIN ────────────────────────────────── */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Key className="h-5 w-5 text-gray-500" />
            {t('profile_page.change_pin', 'Changer mon code PIN')}
          </CardTitle>
          <CardDescription>
            {t('profile_page.pin_desc', 'Votre code PIN est utilisé pour vous identifier et déverrouiller l\'application.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('profile_page.current_pin', 'Code PIN actuel')}</Label>
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

          <div className="space-y-1.5">
            <Label>{t('profile_page.new_pin', 'Nouveau code PIN')}</Label>
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
            <Label>{t('profile_page.confirm_new_pin', 'Confirmer le nouveau code PIN')}</Label>
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
            onClick={handleChangePin}
            disabled={saving}
            className="w-full rounded-xl text-white h-11"
            style={{ backgroundColor: BLUE }}
          >
            {saving ? t('profile_page.saving', 'Enregistrement...') : t('profile_page.update_pin', 'Mettre à jour mon PIN')}
          </Button>

          <p className="text-xs text-gray-400 text-center">
            {t('profile_page.ask_admin_reset_hint', 'Si vous ne connaissez pas votre PIN actuel, demandez à l\'administrateur de le réinitialiser.')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}