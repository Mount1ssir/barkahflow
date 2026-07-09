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
import { toast } from 'sonner'
import { ArrowLeft, Lock, Fingerprint, ShieldCheck, ShieldOff } from 'lucide-react'
import {
  isPinEnabled,
  setPinCode,
  disablePin,
  isBiometricEnabled,
  setBiometricEnabled,
} from '@/lib/pin-storage'
import {
  isBiometricAvailable,
  registerBiometric,
  clearBiometricRegistration,
} from '@/lib/biometric-auth'

const PRIMARY = '#2C3E50'

export default function SecuritySettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')

  const [pinEnabled, setPinEnabledState] = useState(false)
  const [biometricEnabled, setBiometricEnabledState] = useState(false)
  const [biometricAvailable, setBiometricAvailableState] = useState(false)

  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [savingPin, setSavingPin] = useState(false)

  const [disablePinDialogOpen, setDisablePinDialogOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      setUserEmail(data.session?.user?.email || '')
      setPinEnabledState(isPinEnabled())
      setBiometricEnabledState(isBiometricEnabled())
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sécurité</h1>
      </div>

      <Card className="rounded-2xl border shadow-sm mb-6">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Lock className="h-5 w-5 text-gray-500" />
            Verrouillage par code PIN
          </CardTitle>
          <CardDescription>
            Protège l'accès à l'app sur cet appareil avec un code à 4-6 chiffres.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pinEnabled ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <ShieldCheck className="h-4 w-4" />
                Code PIN activé
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-xl" onClick={handleOpenSetPin}>
                  Changer le code   {/* ✅ Bouton pour changer le PIN */}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-red-500 border-red-200 hover:bg-red-50"
                  onClick={() => setDisablePinDialogOpen(true)}
                >
                  Désactiver
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <ShieldOff className="h-4 w-4" />
                Aucun code PIN configuré
              </div>
              <Button
                size="sm"
                className="rounded-xl text-white"
                style={{ backgroundColor: PRIMARY }}
                onClick={handleOpenSetPin}
              >
                Activer le PIN
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
                ? 'Active d\'abord un code PIN'
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

      {/* Dialog pour créer ou changer le PIN */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{pinEnabled ? 'Changer le code PIN' : 'Créer un code PIN'}</DialogTitle>
            <DialogDescription>Choisis un code à 4-6 chiffres.</DialogDescription>
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

      {/* Dialog de confirmation pour désactiver */}
      <Dialog open={disablePinDialogOpen} onOpenChange={setDisablePinDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Désactiver le verrouillage ?</DialogTitle>
            <DialogDescription>
              L'app ne demandera plus de code PIN au démarrage sur cet appareil. La biométrie sera aussi désactivée.
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