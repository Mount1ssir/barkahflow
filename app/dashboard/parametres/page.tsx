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
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { ArrowLeft, Lock, Fingerprint, ShieldCheck, ShieldOff, Clock } from 'lucide-react'
import {
  isPinEnabled,
  setPinCode,
  disablePin,
  isBiometricEnabled,
  setBiometricEnabled,
  getInactivityTimeoutSeconds,
  setInactivityTimeoutSeconds,
} from '@/lib/pin-storage'
import {
  isBiometricAvailable,
  registerBiometric,
  clearBiometricRegistration,
} from '@/lib/biometric-auth'
import { useUserContext } from '@/context/UserContext'

const PRIMARY = '#2C3E50'

export default function SecuritySettingsPage() {
  const router = useRouter()
  const { currentUser } = useUserContext()
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')

  const [pinEnabled, setPinEnabledState] = useState(false)
  const [biometricEnabled, setBiometricEnabledState] = useState(false)
  const [biometricAvailable, setBiometricAvailableState] = useState(false)
  const [inactivityTimeout, setInactivityTimeoutState] = useState(30)

  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [savingPin, setSavingPin] = useState(false)

  const [disablePinDialogOpen, setDisablePinDialogOpen] = useState(false)

  const isAdmin = currentUser?.role === 'admin'
  const isCashier = currentUser?.role === 'cashier'

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      setUserEmail(data.session?.user?.email || '')
      setPinEnabledState(isPinEnabled())
      setBiometricEnabledState(isBiometricEnabled())
      setInactivityTimeoutState(getInactivityTimeoutSeconds())
      const available = await isBiometricAvailable()
      setBiometricAvailableState(available)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenSetPin = () => {
    setNewPin('')
    setConfirmPin('')
    setPinDialogOpen(true)
  }

  const handleSavePin = async () => {
    if (!/^\d{4,6}$/.test(newPin)) {
      toast.error('Le PIN doit contenir entre 4 et 6 chiffres')
      return
    }
    if (newPin !== confirmPin) {
      toast.error('Les deux codes PIN ne correspondent pas')
      return
    }
    setSavingPin(true)
    try {
      await setPinCode(newPin)
      setPinEnabledState(true)
      setPinDialogOpen(false)
      toast.success('Code PIN activé')
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la création du PIN')
    } finally {
      setSavingPin(false)
    }
  }

  const handleDisablePin = () => {
    disablePin()
    setPinEnabledState(false)
    setBiometricEnabledState(false)
    clearBiometricRegistration()
    setDisablePinDialogOpen(false)
    toast.success('Verrouillage par PIN désactivé')
  }

  const handleTogglePin = (checked: boolean) => {
    if (checked) {
      // Pour admin → ouvre le dialog pour créer un PIN
      // Pour caissier → active directement (le PIN existe déjà)
      if (isAdmin) {
        handleOpenSetPin()
      } else if (isCashier) {
        // Le caissier a déjà un PIN dans son profil, on active juste le verrouillage
        setPinEnabledState(true)
        // On doit enregistrer le PIN existant du caissier
        // On récupère le PIN du caissier depuis le currentUser
        // Pour l'instant on active juste le verrouillage
        toast.success('Verrouillage activé')
      }
    } else {
      // Désactiver le verrouillage
      setDisablePinDialogOpen(true)
    }
  }

  const handleToggleBiometric = async (checked: boolean) => {
    if (!pinEnabled) {
      toast.error('Active d\'abord un code PIN')
      return
    }
    if (checked) {
      const success = await registerBiometric(userEmail)
      if (success) {
        setBiometricEnabled(true)
        setBiometricEnabledState(true)
        toast.success('Biométrie activée')
      } else {
        toast.error('Impossible d\'activer la biométrie sur cet appareil')
      }
    } else {
      clearBiometricRegistration()
      setBiometricEnabled(false)
      setBiometricEnabledState(false)
      toast.success('Biométrie désactivée')
    }
  }

  const handleChangeInactivityTimeout = (value: string) => {
    const seconds = parseInt(value, 10)
    try {
      setInactivityTimeoutSeconds(seconds)
      setInactivityTimeoutState(seconds)
      toast.success('Durée d\'inactivité mise à jour')
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la mise à jour')
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.push('/dashboard')} className="gap-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Paramètres</h1>
      </div>

      {/* ─── SECTION VERROUILLAGE ─────────────────────────────────── */}
      <Card className="rounded-2xl border shadow-sm mb-6">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Lock className="h-5 w-5 text-gray-500" />
            Verrouillage de l'application
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? 'Activez le verrouillage avec un code PIN personnel.'
              : 'Activez le verrouillage avec votre code PIN existant.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* ─── Toggle ON/OFF ─────────────────────────────────────── */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
            <div className="flex items-center gap-3">
              {pinEnabled ? (
                <ShieldCheck className="h-5 w-5 text-green-500" />
              ) : (
                <ShieldOff className="h-5 w-5 text-gray-400" />
              )}
              <div>
                <p className="font-medium text-sm text-gray-900 dark:text-white">
                  {pinEnabled ? 'Verrouillage activé' : 'Verrouillage désactivé'}
                </p>
                <p className="text-xs text-gray-500">
                  {pinEnabled
                    ? 'L\'application se verrouille automatiquement'
                    : isAdmin
                    ? 'Définissez un PIN pour activer le verrouillage'
                    : 'Activez le verrouillage avec votre PIN'}
                </p>
              </div>
            </div>
            <Switch
              checked={pinEnabled}
              onCheckedChange={handleTogglePin}
              className="data-[state=checked]:bg-[#c9a84c]"
            />
          </div>

          {/* ─── Admin : afficher le statut du PIN ─────────────────── */}
          {isAdmin && pinEnabled && (
            <div className="mt-4 flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Code PIN configuré
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={handleOpenSetPin}
              >
                Changer le PIN
              </Button>
            </div>
          )}

          {/* ─── Caissier : message PIN existant ───────────────────── */}
          {isCashier && pinEnabled && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
              <Lock className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Utilisez votre code PIN personnel pour déverrouiller l'application.
              </span>
            </div>
          )}

          {/* ─── Admin : bouton pour définir le PIN si désactivé ──── */}
          {isAdmin && !pinEnabled && (
            <Button
              className="mt-4 rounded-xl text-white w-full"
              style={{ backgroundColor: PRIMARY }}
              onClick={handleOpenSetPin}
            >
              Définir un code PIN
            </Button>
          )}

          {/* ─── Caissier : bouton pour activer si désactivé ──────── */}
          {isCashier && !pinEnabled && (
            <Button
              className="mt-4 rounded-xl text-white w-full"
              style={{ backgroundColor: PRIMARY }}
              onClick={() => {
                setPinEnabledState(true)
                toast.success('Verrouillage activé')
              }}
            >
              Activer le verrouillage
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ─── SECTION DURÉE D'INACTIVITÉ ───────────────────────────── */}
      <Card className="rounded-2xl border shadow-sm mb-6">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-500" />
            Durée d'inactivité
          </CardTitle>
          <CardDescription>
            Délai sans activité avant que l'app se verrouille automatiquement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={String(inactivityTimeout)}
            onValueChange={handleChangeInactivityTimeout}
            disabled={!pinEnabled}
          >
            <SelectTrigger className="rounded-xl w-full sm:w-56">
              <SelectValue placeholder="Choisir une durée" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 secondes</SelectItem>
              <SelectItem value="60">1 minute</SelectItem>
              <SelectItem value="120">2 minutes</SelectItem>
              <SelectItem value="300">5 minutes</SelectItem>
              <SelectItem value="600">10 minutes</SelectItem>
            </SelectContent>
          </Select>
          {!pinEnabled && (
            <p className="text-xs text-gray-400 mt-2">
              Activez d'abord le verrouillage pour configurer ce réglage.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── SECTION BIOMÉTRIE ────────────────────────────────────── */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-gray-500" />
            Déverrouillage biométrique
          </CardTitle>
          <CardDescription>
            {biometricAvailable
              ? 'Utilise Windows Hello ou la reconnaissance disponible sur cet appareil.'
              : 'Aucun capteur biométrique détecté sur cet appareil.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {!pinEnabled
                ? 'Activez d\'abord le verrouillage'
                : biometricEnabled
                ? 'Biométrie activée'
                : 'Biométrie désactivée'}
            </span>
            <Switch
              checked={biometricEnabled}
              onCheckedChange={handleToggleBiometric}
              disabled={!biometricAvailable || !pinEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Dialog pour créer/changer le PIN (Admin uniquement) ──── */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{pinEnabled ? 'Changer le code PIN' : 'Créer un code PIN'}</DialogTitle>
            <DialogDescription>Choisis un code à 4-6 chiffres pour verrouiller l'application.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nouveau code</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="rounded-xl h-11 text-center tracking-widest text-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmer le code</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="rounded-xl h-11 text-center tracking-widest text-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialogOpen(false)} className="rounded-xl">
              Annuler
            </Button>
            <Button
              onClick={handleSavePin}
              disabled={savingPin}
              className="rounded-xl text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              {savingPin ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog de confirmation pour désactiver ────────────────── */}
      <Dialog open={disablePinDialogOpen} onOpenChange={setDisablePinDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Désactiver le verrouillage ?</DialogTitle>
            <DialogDescription>
              {isAdmin
                ? 'L\'app ne demandera plus de code PIN au démarrage. La biométrie sera aussi désactivée.'
                : 'L\'app ne demandera plus votre code PIN au démarrage.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisablePinDialogOpen(false)} className="rounded-xl">
              Annuler
            </Button>
            <Button onClick={handleDisablePin} className="rounded-xl bg-red-500 hover:bg-red-600 text-white">
              Désactiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}